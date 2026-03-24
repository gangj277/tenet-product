# Electron Local Filesystem Storage — E2E Implementation Plan

> **Author**: Claude Code (deep audit, 2026-03-24)
> **Status**: Proposal for CTO review
> **Scope**: Make the Electron desktop app run entirely on local filesystem storage while the web app keeps PostgreSQL.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture (As-Is)](#2-current-architecture-as-is)
3. [Target Architecture (To-Be)](#3-target-architecture-to-be)
4. [The Storage Adapter Interface](#4-the-storage-adapter-interface)
5. [Filesystem Adapter Design](#5-filesystem-adapter-design)
6. [Auth Layer Changes](#6-auth-layer-changes)
7. [Blob Store (Already Solved)](#7-blob-store-already-solved)
8. [Memory Store & Rate Limiting](#8-memory-store--rate-limiting)
9. [Middleware & Routing](#9-middleware--routing)
10. [LLM Provider Factory](#10-llm-provider-factory)
11. [Engine Pipeline & Agent](#11-engine-pipeline--agent)
12. [Frontend Changes](#12-frontend-changes)
13. [Electron Main Process Changes](#13-electron-main-process-changes)
14. [Migration Path (File-by-File)](#14-migration-path-file-by-file)
15. [Data Directory Structure](#15-data-directory-structure)
16. [Testing Strategy](#16-testing-strategy)
17. [Risks & Edge Cases](#17-risks--edge-cases)
18. [Implementation Phases](#18-implementation-phases)
19. [Decision Log (Needs CTO Input)](#19-decision-log-needs-cto-input)

---

## 1. Executive Summary

**Goal**: When running as an Electron desktop app, Lumen should store all data on the user's local filesystem (JSON files + directories) instead of requiring a PostgreSQL database. The web app continues using PostgreSQL unchanged.

**Why**: Removes the PostgreSQL dependency for desktop users. No database to install, configure, or maintain. Data lives on the user's machine, like Cursor, VS Code, or Claude Code.

**Approach**: Storage Adapter Pattern — define one interface, implement two backends (Postgres + Filesystem), switch at startup based on `process.env.ELECTRON`.

**Estimated effort**: ~3-4 days of focused implementation across 4 phases.

**Key finding from audit**: The codebase is well-structured for this change. All DB access is server-only, centralized in `lib/db/`, and the frontend communicates exclusively through REST API routes. No client-side DB access exists. The blob store already has a local filesystem implementation.

---

## 2. Current Architecture (As-Is)

### 2.1 Data Flow

```
Browser (Electron BrowserWindow or Web)
    |
    | fetch() to /api/* routes
    v
Next.js API Routes (app/api/*)
    |
    | import { db } from "@/lib/db/client"
    | import { memoryStore } from "@/lib/storage/memory-store"
    | import { blobStore } from "@/lib/storage/blob-store"
    v
PostgreSQL (via Drizzle ORM)  +  In-Memory Maps  +  R2/Local Files
```

### 2.2 Database Layer Inventory

**Client**: `lib/db/client.ts` — single Drizzle instance with `node-postgres` pool

**Schema**: `lib/db/schema.ts` — 14 tables, 6 PostgreSQL enums

| Table | Rows (typical) | Primary Access Pattern |
|-------|---------------|----------------------|
| `users` | 1 per user | Lookup by email, by ID |
| `user_llm_credentials` | 1 per user | Lookup by userId |
| `projects` | 10-50 per user | List by userId, CRUD by ID |
| `runs` | 1 per project | Lookup by projectId, by ID |
| `user_inputs` | 1 per run | Lookup by runId |
| `sources` | 5-50 per run | List by runId, CRUD by ID |
| `source_chunks` | 50-500 per run | List by sourceId |
| `perspectives` | 1 per run | Lookup by runId |
| `artifacts` | 5-20 per run | List by runId, CRUD by type |
| `chat_sessions` | 1-10 per run | List by runId, CRUD by ID |
| `chat_messages` | 10-500 per session | List by sessionId, append |
| `papers` | 0-5 per run | CRUD by ID |
| `notes` | 0-20 per run | CRUD by ID |
| `experiments` | 0-10 per run | CRUD by ID |
| `run_errors` | 0-5 per run | Append by runId |

### 2.3 Data Access Modules (8 files, ~30 exported functions)

| Module | Functions | Notes |
|--------|-----------|-------|
| `research-project-lifecycle.ts` | `createResearchProjectRun`, `createDraftWorkspaceProjectRun`, `updateResearchRunStatus`, `upsertResearchRunInput`, `updateProjectTitle`, `listResearchProjectsForUser`, `getOwnedResearchRun`, `getResearchRun` | Uses transactions, LEFT JOIN for project list |
| `research-project-artifacts.ts` | `persistResearchArtifacts`, `getPersistedArtifacts`, `updateArtifactContents`, `getPersistedSourcesForRun` | Heavy transactions, bulk delete+insert pattern |
| `research-project-sources.ts` | `getSourceMetadataForRun`, `deleteSource`, `addAgentDiscoveredSource` | Cascade-aware deletes, JSONB metadata |
| `research-project-notes.ts` | `createNote`, `deleteNote`, `updateNoteMeta`, `getNoteMetadataForRun` | Simple CRUD |
| `research-project-experiments.ts` | `createExperiment`, `deleteExperiment`, `getExperimentMetadataForRun`, `deletePaper` | Simple CRUD |
| `chat-sessions.ts` | `getSessionsForRun`, `createSession`, `getSessionMessages`, `appendMessages`, `updateSessionTitle`, `updateMessageMetadata`, `deleteSession` | Raw SQL for COUNT aggregate |
| `user-credentials.ts` | `getUserLLMCredentials`, `upsertUserLLMCredentials`, `deleteUserLLMCredentials` | AES-256-GCM encrypted tokens |
| `backfill-warm-runs.ts` | `backfillWarmRunsForUser` | Syncs DB -> memoryStore on dashboard load |

### 2.4 PostgreSQL-Specific Features Used

| Feature | Where Used | FS Adapter Strategy |
|---------|-----------|-------------------|
| `pgEnum` (6 enums) | Schema definitions | Validate strings at write time |
| `jsonb` columns | sources.metadata, runs.evidence_map, perspectives.*, chat_messages.metadata, user_llm_credentials.capabilities | Native JSON — no change needed |
| Transactions (10+ uses) | Multi-table writes (project+run+inputs, delete+reinsert artifacts) | Atomic file writes via write-then-rename |
| `LEFT JOIN` | `listResearchProjectsForUser` (projects + runs) | In-memory join over two JSON reads |
| `COUNT` aggregate (raw SQL) | `getSessionsForRun` message count | Count array length |
| `inArray()` | `persistResearchArtifacts` bulk operations | Array.filter() |
| `CASCADE` deletes | FK constraints on all child tables | Manual recursive delete |
| UUIDs (default random) | All primary keys | `crypto.randomUUID()` |
| Timestamps (withTimezone) | All `createdAt`/`updatedAt` | ISO strings |

### 2.5 API Routes Consuming DB (22 files)

All in `app/api/`. Every route follows this pattern:
```typescript
const session = await getSession();              // Auth check
const ownedRun = await getOwnedResearchRun(...); // Ownership check
// ... business logic using lib/db/* functions
```

### 2.6 Electron Current State

- `electron/main.ts`: Spawns Next.js server, sets `ELECTRON=1`
- `electron/preload.ts`: Exposes `{ isElectron: true, platform }` via contextBridge
- `electron/load-env.ts`: Loads `.env*` files
- `electron/server-launch.ts`: Production standalone server config
- `scripts/dev-start.sh`: Ensures PostgreSQL running, creates DB, runs migrations

### 2.7 Blob Store (Already Has FS Backend)

`lib/storage/blob-store.ts` already implements:
- `LocalBlobStore` — filesystem-based, uses `fs/promises`
- `R2BlobStore` — Cloudflare R2 via S3 SDK
- `FallbackBlobStore` — tries R2, falls back to local

**This means source PDFs, document chunks, etc. already work on local filesystem.** No changes needed for blob storage.

---

## 3. Target Architecture (To-Be)

```
Browser (Electron BrowserWindow)
    |
    | fetch() to /api/* routes (unchanged)
    v
Next.js API Routes (app/api/*)
    |
    | import { storage } from "@/lib/storage"  <-- NEW unified import
    v
    ├── [Web]      PostgresAdapter  (wraps existing Drizzle code)
    └── [Electron]  FsAdapter       (JSON files on disk)
```

### Key Principle: API Routes Don't Change Shape

The frontend is untouched. API routes still expose the same endpoints with the same request/response contracts. Only the storage implementation behind them changes.

---

## 4. The Storage Adapter Interface

This is the single most important design artifact. Every DB function currently exported from `lib/db/` must appear in this interface.

```typescript
// lib/storage/adapter.ts

export interface StorageAdapter {
  // ── Projects ──
  listProjectsForUser(userId: string): Promise<DashboardProjectRecord[]>;
  createProjectRun(params: CreateProjectRunParams): Promise<void>;
  createDraftWorkspaceProjectRun(params: CreateDraftParams): Promise<{ title: string; noteId: string }>;
  updateProjectTitle(projectId: string, title: string): Promise<void>;
  updateRunStatus(params: UpdateRunStatusParams): Promise<void>;
  upsertRunInput(runId: string, input: UserInput): Promise<void>;
  getOwnedRun(userId: string, runId: string): Promise<OwnedRunRecord | null>;
  getRun(runId: string): Promise<OwnedRunRecord | null>;
  deleteProject(projectId: string): Promise<void>;

  // ── Artifacts ──
  persistArtifacts(params: PersistArtifactsParams): Promise<void>;
  getArtifacts(runId: string): Promise<Artifacts | null>;
  updateArtifactContents(runId: string, edits: Record<string, string>): Promise<void>;
  getSourcesForRun(runId: string): Promise<SourceEntry[]>;

  // ── Sources ──
  getSourceMetadata(runId: string): Promise<Record<string, SourceMeta>>;
  deleteSource(runId: string, sourceId: string): Promise<void>;
  addDiscoveredSource(runId: string, source: DiscoveredSourceParams): Promise<void>;

  // ── Notes ──
  createNote(runId: string, params: CreateNoteParams): Promise<void>;
  deleteNote(runId: string, noteId: string): Promise<void>;
  updateNoteMeta(runId: string, noteId: string, meta: Partial<NoteMeta>): Promise<void>;
  getNoteMetadata(runId: string): Promise<Record<string, NoteMeta>>;

  // ── Experiments ──
  createExperiment(runId: string, params: CreateExperimentParams): Promise<void>;
  deleteExperiment(runId: string, experimentId: string): Promise<void>;
  getExperimentMetadata(runId: string): Promise<Record<string, ExperimentMeta>>;

  // ── Papers ──
  deletePaper(runId: string, paperId: string): Promise<void>;

  // ── Chat ──
  getSessionsForRun(runId: string): Promise<SessionSummary[]>;
  createSession(runId: string, params?: { id?: string }): Promise<{ id: string }>;
  getSessionMessages(sessionId: string): Promise<ChatMessage[]>;
  appendMessages(sessionId: string, messages: NewChatMessage[]): Promise<void>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  updateMessageMetadata(sessionId: string, messageId: string, metadata: Record<string, unknown>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // ── User / Auth ──
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
  upsertUser(params: UpsertUserParams): Promise<User>;
  updateUserProfile(userId: string, params: { name?: string; organization?: string }): Promise<void>;

  // ── LLM Credentials ──
  getLLMCredentials(userId: string): Promise<LLMCredentialRecord | null>;
  upsertLLMCredentials(userId: string, creds: LLMCredentialUpsert): Promise<void>;
  deleteLLMCredentials(userId: string): Promise<void>;
}
```

### 4.1 Adapter Factory

```typescript
// lib/storage/index.ts
import type { StorageAdapter } from "./adapter";

let _adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (_adapter) return _adapter;

  if (process.env.ELECTRON) {
    // Lazy import to avoid bundling fs-adapter in web builds
    const { createFsAdapter } = require("./fs-adapter");
    const dataDir = process.env.LUMEN_DATA_DIR || getElectronDataDir();
    _adapter = createFsAdapter(dataDir);
  } else {
    const { createPostgresAdapter } = require("./postgres-adapter");
    _adapter = createPostgresAdapter();
  }

  return _adapter;
}
```

### 4.2 PostgresAdapter (Wraps Existing Code)

This is a thin wrapper that delegates to the existing `lib/db/` modules. Minimal new code — mostly re-exports with the interface shape:

```typescript
// lib/storage/postgres-adapter.ts
import * as lifecycle from "@/lib/db/research-project-lifecycle";
import * as artifacts from "@/lib/db/research-project-artifacts";
// ... etc

export function createPostgresAdapter(): StorageAdapter {
  return {
    listProjectsForUser: lifecycle.listResearchProjectsForUser,
    createProjectRun: lifecycle.createResearchProjectRun,
    getOwnedRun: lifecycle.getOwnedResearchRun,
    getRun: lifecycle.getResearchRun,
    // ... delegate every method to existing functions
  };
}
```

**Effort**: Small. Just mapping function signatures. The existing `lib/db/` code stays intact.

---

## 5. Filesystem Adapter Design

### 5.1 Data Directory Layout

```
{LUMEN_DATA_DIR}/
├── user.json                           # Single-user profile + LLM credentials
├── projects/
│   ├── index.json                      # [{id, title, status, createdAt, updatedAt, runId}]
│   ├── {project-id}/
│   │   ├── project.json                # {id, userId, title, status, createdAt, updatedAt}
│   │   ├── run.json                    # {id, projectId, status, currentStep, startedAt, completedAt}
│   │   ├── user-input.json             # Research question, intent, scope, etc.
│   │   ├── perspective.json            # Inferred research frame
│   │   ├── errors.json                 # [{step, message, retryable, createdAt}]
│   │   ├── sources/
│   │   │   ├── index.json              # [{sourceId, name, origin, mimeType, ...}]
│   │   │   └── {source-id}.json        # Full source metadata + chunk refs
│   │   ├── artifacts/
│   │   │   ├── overview.md
│   │   │   ├── synthesis.md
│   │   │   ├── claims.md
│   │   │   ├── gaps.md
│   │   │   ├── next-steps.md
│   │   │   └── source-summaries/
│   │   │       └── {source-id}.md
│   │   ├── notes/
│   │   │   ├── index.json              # [{id, label, folder, createdAt, updatedAt}]
│   │   │   └── {note-id}.md
│   │   ├── papers/
│   │   │   ├── index.json
│   │   │   └── {paper-id}.tex
│   │   ├── experiments/
│   │   │   ├── index.json
│   │   │   └── {experiment-id}.json
│   │   └── chat/
│   │       ├── sessions.json           # [{id, title, createdAt, updatedAt, messageCount}]
│   │       └── {session-id}/
│   │           └── messages.json       # [{id, role, text, metadata, createdAt}]
│   └── ...
└── blob-store/                         # Already exists (LOCAL_BLOB_ROOT)
    └── sources/
        └── {source-id}/
            └── raw.pdf
```

### 5.2 Core FS Operations

All filesystem operations use a safe atomic-write pattern:

```typescript
// Write to temp file, then rename (atomic on all OS)
async function atomicWriteJSON(filePath: string, data: unknown): Promise<void> {
  const tmp = filePath + ".tmp." + Date.now();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, filePath);
}

async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}
```

### 5.3 Transaction Equivalence

PostgreSQL transactions are used for multi-table atomicity. On the filesystem:

| Postgres Pattern | FS Strategy |
|-----------------|------------|
| Insert project + run + input atomically | Write all 3 JSON files, then update `index.json` last (the index is the "commit point") |
| Delete + reinsert all artifacts | Write new artifacts to temp dir, then rename over old dir |
| Upsert (update or insert) | Read, modify, atomic write |

**Key insight**: For a single-user desktop app, concurrency conflicts are essentially impossible. The main risk is crash-during-write, which atomic rename handles.

### 5.4 Query Equivalence

| Postgres Pattern | FS Strategy |
|-----------------|------------|
| `SELECT ... WHERE runId = ?` | Read `projects/{projectId}/run.json` (runId->projectId mapping in index) |
| `SELECT ... WHERE userId = ?` | Read `projects/index.json` (single user, all projects are theirs) |
| `LEFT JOIN runs ON projectId` | Read `index.json` (already denormalized with runId) |
| `COUNT(messages)` | Read `messages.json`, return `.length` |
| `ORDER BY createdAt DESC` | Sort array in memory |
| `inArray(ids)` | `array.filter(item => ids.includes(item.id))` |

### 5.5 ID Mapping

PostgreSQL uses `uuid.defaultRandom()`. The FS adapter uses `crypto.randomUUID()` — same format, same uniqueness guarantees.

The one complexity is **runId -> projectId mapping**. Currently the DB uses JOIN to resolve this. For FS, maintain a reverse lookup in `projects/index.json`:

```json
[
  { "id": "proj-uuid", "runId": "run-uuid", "title": "...", "status": "completed", ... }
]
```

This allows O(1) lookup: `index.find(p => p.runId === runId)`.

### 5.6 Cascade Deletes

When a project is deleted, all child data must go too:

```typescript
async deleteProject(projectId: string): Promise<void> {
  // Remove entire project directory (includes run, sources, artifacts, chat, etc.)
  await rm(path.join(this.dataDir, "projects", projectId), { recursive: true, force: true });
  // Update index
  const index = await readJSON<ProjectIndex[]>(this.indexPath, []);
  await atomicWriteJSON(this.indexPath, index.filter(p => p.id !== projectId));
}
```

Simpler than PostgreSQL cascades — `rm -rf` on the directory handles everything.

---

## 6. Auth Layer Changes

### 6.1 Current Auth Flow

```
OpenAI OAuth / Token Paste
  -> connectOpenAIAccount()
  -> Upsert user in `users` table
  -> Encrypt & store tokens in `user_llm_credentials` table
  -> Create JWT session cookie
```

### 6.2 Electron Auth Strategy: Single-User, No Account

In Electron mode, the user IS the OS user. No signup, no login page.

| Web | Electron |
|-----|----------|
| OpenAI OAuth flow | Skip entirely |
| JWT session cookie | Auto-created on app start |
| `users` table | `user.json` file |
| `user_llm_credentials` table | `user.json` (same file, `credentials` field) |
| `getSession()` returns userId | Returns hardcoded local user ID |
| `getOwnedResearchRun()` checks userId | Skips ownership check (single user) |

### 6.3 Electron Session Bypass

```typescript
// lib/auth/session.ts — modify getSession()
export async function getSession(): Promise<SessionPayload | null> {
  if (process.env.ELECTRON) {
    // Single-user mode: always authenticated as the local user
    return {
      userId: getLocalUserId(),  // Read from user.json or create
      email: "local@lumen.app",
    };
  }
  // ... existing JWT verification
}
```

### 6.4 LLM Credential Storage (Electron)

The user still needs OpenAI credentials for LLM access. In Electron mode:

**Option A (Recommended)**: Read from `~/.codex/auth.json` (already implemented in `lib/auth/codex-local-auth.ts`). This is what the app already does as a fallback. The Electron app can auto-detect this file on startup.

**Option B**: Store in `{LUMEN_DATA_DIR}/user.json` with encryption:
```json
{
  "id": "local-user-uuid",
  "name": "User",
  "credentials": {
    "provider": "openai_auth",
    "encryptedTokens": "...",
    "validationStatus": "valid",
    "capabilities": { "basic": true, "json": true, ... }
  }
}
```

**Option C**: Use the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) via `keytar` or Electron's `safeStorage` API for token encryption. Most secure option.

> **CTO Decision Needed**: Which credential storage approach for Electron? Option A is simplest (reuse codex auth), Option C is most secure for production.

### 6.5 Middleware Changes

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // In Electron mode, skip all auth checks
  if (process.env.ELECTRON) {
    return NextResponse.next();
  }
  // ... existing JWT verification
}
```

### 6.6 Files to Modify

| File | Change |
|------|--------|
| `lib/auth/session.ts` | Add `ELECTRON` bypass in `getSession()` |
| `middleware.ts` | Skip auth in Electron mode |
| `app/dashboard/layout.tsx` | Skip OpenAI connection check in Electron |
| `lib/auth/use-user.ts` | Return local user in Electron mode |
| `app/api/auth/me/route.ts` | Return local user from `user.json` |
| `app/auth/login/page.tsx` | Redirect to `/dashboard` immediately in Electron |

---

## 7. Blob Store (Already Solved)

**No changes needed.** The existing `lib/storage/blob-store.ts` already has:

- `LocalBlobStore` — writes to `{LOCAL_BLOB_ROOT}/{key}`
- `FallbackBlobStore` — tries R2 first, falls back to local

In Electron mode, R2 credentials won't be set, so `createBlobStore()` automatically returns `LocalBlobStore`. The blob root defaults to `{cwd}/.lumen-blob-store/`.

**One small change**: Set `LOCAL_BLOB_ROOT` to `{LUMEN_DATA_DIR}/blob-store/` in Electron mode so all data lives in one place:

```typescript
// electron/main.ts — add to env configuration
env.LOCAL_BLOB_ROOT = path.join(app.getPath("userData"), "blob-store");
```

---

## 8. Memory Store & Rate Limiting

### 8.1 Memory Store (`lib/storage/memory-store.ts`)

**No changes needed.** The memory store is an in-memory cache used for:
- Active run state during pipeline execution
- Progress tracking
- Pending ask-user questions
- Temporary file buffers

It works identically regardless of storage backend. It's already not persisted to the database.

### 8.2 Rate Limiting (`lib/rate-limit.ts`)

**Minor change**: In Electron mode, rate limiting is less critical (single user, their own API key). Options:

1. **Keep as-is** — still useful to prevent runaway LLM costs
2. **Raise the limit** — `USER_DAILY_BUDGET_USD=100` for local users
3. **Disable entirely** — `if (process.env.ELECTRON) return { allowed: true, ... }`

> **CTO Decision Needed**: Keep rate limiting in Electron? Recommend keeping it with a higher limit as a safety net.

---

## 9. Middleware & Routing

### 9.1 Auth Middleware (covered in Section 6.5)

Skip JWT verification when `ELECTRON=1`.

### 9.2 API Routes — The Refactoring Pattern

Every API route currently imports directly from `@/lib/db/*`. The refactoring pattern is mechanical:

**Before:**
```typescript
// app/api/projects/route.ts
import { listResearchProjectsForUser } from "@/lib/db/research-projects";

export async function GET() {
  const session = await getSession();
  const projects = await listResearchProjectsForUser(session.userId);
  return NextResponse.json({ projects });
}
```

**After:**
```typescript
// app/api/projects/route.ts
import { getStorage } from "@/lib/storage";

export async function GET() {
  const session = await getSession();
  const projects = await getStorage().listProjectsForUser(session.userId);
  return NextResponse.json({ projects });
}
```

The response shape is identical. The frontend doesn't change at all.

### 9.3 Full API Route Refactoring List

| Route File | DB Functions to Replace |
|------------|----------------------|
| `api/projects/route.ts` | `listResearchProjectsForUser`, `createDraftWorkspaceProjectRun`, `backfillWarmRunsForUser` |
| `api/projects/[projectId]/route.ts` | `db.delete(projects)` |
| `api/init/route.ts` | `createResearchProjectRun`, `updateResearchRunStatus` |
| `api/init/[runId]/route.ts` | `getOwnedResearchRun` |
| `api/init/[runId]/start/route.ts` | `getOwnedResearchRun`, `getPersistedSourcesForRun`, `updateProjectTitle`, `updateResearchRunStatus`, `upsertResearchRunInput` |
| `api/init/[runId]/confirm/route.ts` | `getOwnedResearchRun`, `updateResearchRunStatus`, `updateProjectTitle` |
| `api/init/[runId]/artifacts/route.ts` | `getOwnedResearchRun`, `getPersistedArtifacts`, `getSourceMetadataForRun`, `getNoteMetadataForRun`, `getExperimentMetadataForRun`, `updateArtifactContents` |
| `api/init/[runId]/sources/route.ts` | `getOwnedResearchRun`, `getSourceMetadataForRun`, `addAgentDiscoveredSource` |
| `api/init/[runId]/sources/[sourceId]/route.ts` | `getOwnedResearchRun`, `deleteSource` |
| `api/init/[runId]/notes/route.ts` | `getOwnedResearchRun`, `createNote` |
| `api/init/[runId]/notes/[noteId]/route.ts` | `getOwnedResearchRun`, `deleteNote`, `updateNoteMeta` |
| `api/init/[runId]/experiments/route.ts` | `getOwnedResearchRun`, `createExperiment` |
| `api/init/[runId]/experiments/[experimentId]/route.ts` | `getOwnedResearchRun`, `deleteExperiment` |
| `api/init/[runId]/papers/[paperId]/route.ts` | `getOwnedResearchRun`, `deletePaper` |
| `api/agent/[runId]/chat/route.ts` | `getOwnedResearchRun`, `getPersistedArtifacts`, `getSourceMetadataForRun`, `getExperimentMetadataForRun`, `getNoteMetadataForRun` |
| `api/agent/[runId]/sessions/route.ts` | `getOwnedResearchRun`, `getSessionsForRun`, `createSession` |
| `api/agent/[runId]/sessions/[sessionId]/route.ts` | `getOwnedResearchRun`, `getSessionMessages`, `deleteSession`, `updateSessionTitle` |
| `api/agent/[runId]/sessions/[sessionId]/messages/route.ts` | `getOwnedResearchRun`, `appendMessages`, `updateMessageMetadata` |
| `api/agent/[runId]/sessions/[sessionId]/generate-title/route.ts` | `getOwnedResearchRun`, `updateSessionTitle` |
| `api/agent/[runId]/sessions/[sessionId]/compact/route.ts` | `getOwnedResearchRun`, chat session functions |
| `api/agent/[runId]/answer/route.ts` | `getOwnedResearchRun` |
| `api/auth/me/route.ts` | `db.select(users)`, `db.select(userLlmCredentials)` |
| `api/auth/onboarding/route.ts` | `db.update(users)` |

**Also in non-route files:**

| File | DB Functions to Replace |
|------|----------------------|
| `lib/engine/nodes/persist-project.ts` | `persistResearchArtifacts` |
| `lib/agent/tools/search-external-persist.ts` | `addAgentDiscoveredSource`, `getSourceMetadataForRun` |
| `lib/llm/provider-factory.ts` | `getUserLLMCredentials`, `upsertUserLLMCredentials` |
| `lib/llm/openai-access.ts` | `getUserLLMCredentials` |
| `lib/llm/openai-connection.ts` | credential functions |
| `lib/auth/openai-account.ts` | `db.select(users)`, `upsertUserLLMCredentials` |
| `lib/workspace/source-cache.ts` | `getResearchRun` |
| `lib/db/backfill-warm-runs.ts` | Multiple functions |

---

## 10. LLM Provider Factory

### 10.1 Current Flow

```typescript
// lib/llm/provider-factory.ts
export async function createProviderForUser(userId: string) {
  const creds = await getUserLLMCredentials(userId);  // DB query
  // ... create OpenAI provider with encrypted tokens
}
```

### 10.2 Change

Replace `getUserLLMCredentials(userId)` with `getStorage().getLLMCredentials(userId)`.

In Electron mode, the FS adapter reads from `user.json` or `~/.codex/auth.json`. The provider factory doesn't need to know the difference.

The `persistCredentials` callback (for token refresh) similarly goes through `getStorage().upsertLLMCredentials()`.

---

## 11. Engine Pipeline & Agent

### 11.1 LangGraph Pipeline (`lib/engine/graph.ts`)

The pipeline nodes pass state through the LangGraph `StateGraph`. Only one node touches the database:

- **`persist-project.ts`** — calls `persistResearchArtifacts()` at the end of the pipeline

All other nodes (`analyze-evidence`, `synthesize-project`, etc.) work with in-memory state and `memoryStore`. They don't touch the DB directly.

**Change needed**: In `persist-project.ts`, replace:
```typescript
import { persistResearchArtifacts } from "@/lib/db/research-projects";
```
with:
```typescript
import { getStorage } from "@/lib/storage";
// ...
await getStorage().persistArtifacts({ runId, sources, artifacts, ... });
```

### 11.2 Agent Tools

Only one agent tool touches the DB:

- **`search-external-persist.ts`** — calls `addAgentDiscoveredSource()` and `getSourceMetadataForRun()`

Same pattern: replace with `getStorage()` calls.

---

## 12. Frontend Changes

### 12.1 No Data Fetching Changes

The frontend communicates exclusively through `/api/*` endpoints. Since the API routes maintain the same request/response contracts, **zero frontend data fetching changes are needed**.

### 12.2 Auth UI Changes

| Component | Change |
|-----------|--------|
| `app/auth/login/page.tsx` | If `window.electronAPI?.isElectron`, redirect straight to `/dashboard` |
| `app/auth/onboarding/page.tsx` | If Electron, skip or show simplified version (just name input) |
| `app/dashboard/layout.tsx` | If Electron, skip OpenAI connection status banner (or show a local version that checks `~/.codex/auth.json`) |

### 12.3 Landing Page

| Component | Change |
|-----------|--------|
| `app/page.tsx` (landing) | If Electron, redirect to `/dashboard` (no marketing page needed) |
| `app/_components/landing/*` | No changes (never rendered in Electron) |

### 12.4 Electron Detection on Client

Already available via:
```typescript
const isElectron = typeof window !== "undefined" && (window as any).electronAPI?.isElectron;
```

---

## 13. Electron Main Process Changes

### 13.1 Remove PostgreSQL Dependency

```typescript
// electron/main.ts

async function startServer(): Promise<number> {
  // REMOVE: await ensureDevDatabaseSchema();  <-- No more Drizzle migrations

  const port = await findFreePort();
  const dataDir = app.getPath("userData");  // ~/Library/Application Support/Lumen/

  const env = {
    ...loadAppEnv(process.cwd()),
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    ELECTRON: "1",
    LUMEN_DATA_DIR: dataDir,                           // NEW
    LOCAL_BLOB_ROOT: path.join(dataDir, "blob-store"), // NEW
    ...envConfig,
  };

  // ... rest unchanged
}
```

### 13.2 Remove `scripts/dev-start.sh` PostgreSQL Dependency

Create a separate dev script for Electron that doesn't require PostgreSQL:

```bash
# scripts/electron-dev.sh
#!/bin/bash
export ELECTRON=1
export LUMEN_DATA_DIR="${HOME}/.lumen-dev"
export LOCAL_BLOB_ROOT="${LUMEN_DATA_DIR}/blob-store"
npm run dev:next
```

### 13.3 First-Run Data Directory Setup

On first launch, the Electron app should create the data directory structure:

```typescript
// lib/storage/fs-adapter.ts
async function ensureDataDir(dataDir: string): Promise<void> {
  await mkdir(path.join(dataDir, "projects"), { recursive: true });

  // Create default user.json if not exists
  const userPath = path.join(dataDir, "user.json");
  if (!existsSync(userPath)) {
    await atomicWriteJSON(userPath, {
      id: crypto.randomUUID(),
      name: "User",
      email: "local@lumen.app",
      createdAt: new Date().toISOString(),
    });
  }
}
```

---

## 14. Migration Path (File-by-File)

### Phase 1: Define Interface + Postgres Adapter (no behavior change)

| # | Action | File |
|---|--------|------|
| 1 | Create StorageAdapter interface | `lib/storage/adapter.ts` (NEW) |
| 2 | Create type definitions | `lib/storage/types.ts` (NEW) |
| 3 | Create PostgresAdapter wrapping existing code | `lib/storage/postgres-adapter.ts` (NEW) |
| 4 | Create adapter factory | `lib/storage/index.ts` (MODIFY) |
| 5 | Add exports | `lib/storage/index.ts` |

### Phase 2: Implement Filesystem Adapter

| # | Action | File |
|---|--------|------|
| 6 | Core FS utilities (atomicWrite, readJSON) | `lib/storage/fs/utils.ts` (NEW) |
| 7 | Project CRUD | `lib/storage/fs/projects.ts` (NEW) |
| 8 | Artifact CRUD | `lib/storage/fs/artifacts.ts` (NEW) |
| 9 | Source CRUD | `lib/storage/fs/sources.ts` (NEW) |
| 10 | Note/Experiment/Paper CRUD | `lib/storage/fs/documents.ts` (NEW) |
| 11 | Chat session/message CRUD | `lib/storage/fs/chat.ts` (NEW) |
| 12 | User/credential CRUD | `lib/storage/fs/user.ts` (NEW) |
| 13 | Assemble FsAdapter | `lib/storage/fs-adapter.ts` (NEW) |

### Phase 3: Rewire Consumers

| # | Action | File(s) |
|---|--------|---------|
| 14 | Rewire auth layer | `lib/auth/session.ts`, `lib/auth/openai-account.ts` |
| 15 | Rewire middleware | `middleware.ts` |
| 16 | Rewire all `api/projects/` routes | 2 files |
| 17 | Rewire all `api/init/` routes | 10 files |
| 18 | Rewire all `api/agent/` routes | 7 files |
| 19 | Rewire all `api/auth/` routes | 4 files |
| 20 | Rewire engine pipeline | `lib/engine/nodes/persist-project.ts` |
| 21 | Rewire agent tools | `lib/agent/tools/search-external-persist.ts` |
| 22 | Rewire LLM provider factory | `lib/llm/provider-factory.ts`, `lib/llm/openai-access.ts`, `lib/llm/openai-connection.ts` |
| 23 | Rewire workspace source cache | `lib/workspace/source-cache.ts` |
| 24 | Rewire backfill | `lib/db/backfill-warm-runs.ts` |

### Phase 4: Electron + Frontend Polish

| # | Action | File(s) |
|---|--------|---------|
| 25 | Update Electron main process | `electron/main.ts` |
| 26 | Add Electron dev script | `scripts/electron-dev.sh` (NEW) |
| 27 | Add auth bypass for Electron UI | `app/auth/login/page.tsx`, `app/dashboard/layout.tsx` |
| 28 | Add Electron landing redirect | `app/page.tsx` or `app/layout.tsx` |
| 29 | Set blob store path in Electron env | `electron/main.ts` |
| 30 | Update `package.json` scripts | `package.json` |

---

## 15. Data Directory Structure

### Default Paths by Platform

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Lumen/` |
| Windows | `%APPDATA%/Lumen/` |
| Linux | `~/.config/Lumen/` |

These are the standard Electron `app.getPath("userData")` paths.

### Dev Mode Path

`~/.lumen-dev/` — separate from production to prevent data contamination.

---

## 16. Testing Strategy

### 16.1 Unit Tests for FS Adapter

Test every StorageAdapter method against the filesystem implementation:

```typescript
// tests/fs-adapter.test.ts
import { createFsAdapter } from "@/lib/storage/fs-adapter";
import { mkdtemp, rm } from "fs/promises";
import path from "path";

let adapter: StorageAdapter;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-test-"));
  adapter = createFsAdapter(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

test("createProjectRun and listProjectsForUser", async () => {
  await adapter.createProjectRun({ projectId: "p1", runId: "r1", userId: "u1", ... });
  const projects = await adapter.listProjectsForUser("u1");
  expect(projects).toHaveLength(1);
  expect(projects[0].id).toBe("p1");
});
```

### 16.2 Integration Tests

Run the existing test suite with `ELECTRON=1` to verify the FS adapter produces the same API responses as the Postgres adapter.

### 16.3 Cross-Adapter Conformance Tests

Write tests that run the same operations against both adapters and compare results:

```typescript
for (const [name, createAdapter] of [
  ["postgres", () => createPostgresAdapter()],
  ["filesystem", () => createFsAdapter(tmpDir)],
]) {
  describe(`StorageAdapter (${name})`, () => {
    // ... identical test suite
  });
}
```

### 16.4 Manual Testing

1. Start Electron in dev mode without PostgreSQL running — should work
2. Create project, upload sources, run analysis pipeline
3. Close app, reopen — all data should be persisted
4. Test on macOS, Windows, Linux

---

## 17. Risks & Edge Cases

### 17.1 Concurrent Writes

**Risk**: Two async operations writing to the same file simultaneously.
**Mitigation**: Single-user desktop app + Node.js single-threaded event loop = no real concurrency. Atomic rename protects against crash-during-write. If needed, add a simple file-level mutex using `lockfile` package.

### 17.2 Large Projects

**Risk**: A project with 500+ sources could make `index.json` large.
**Mitigation**: At 500 sources with metadata, the index is ~500KB — well within FS performance limits. If this ever becomes an issue, split into multiple index files or use SQLite as the FS backend.

### 17.3 Data Corruption

**Risk**: Power failure mid-write corrupts JSON.
**Mitigation**: Atomic write pattern (write temp file, then rename). Rename is atomic on all modern filesystems (APFS, NTFS, ext4). Additionally, keep a `.bak` of the previous version before overwriting.

### 17.4 Schema Evolution

**Risk**: Adding new fields to the data model requires migrating JSON files.
**Mitigation**: Use defensive reads — always provide defaults for missing fields:
```typescript
const project = await readJSON(path, { ...DEFAULT_PROJECT, ...existingData });
```
For structural migrations (rare), add a `schemaVersion` field to `user.json` and migrate on read.

### 17.5 Drizzle ORM Import Side Effects

**Risk**: Importing Drizzle or `pg` in Electron mode fails or adds unnecessary bundle weight.
**Mitigation**: The adapter factory uses lazy `require()` / dynamic `import()` so the Postgres adapter is never loaded in Electron mode. Tree-shaking in production builds handles the rest.

### 17.6 Database-Specific Behavior Drift

**Risk**: Over time, the two adapters produce subtly different results (sort order, null handling, timestamp precision).
**Mitigation**: Conformance test suite (Section 16.3) catches these. Keep the interface contract strict with well-defined return types.

### 17.7 Existing Electron Users with PostgreSQL

**Risk**: Users who currently use Electron with PostgreSQL lose their data.
**Mitigation**: On first Electron launch with FS adapter, check if `DATABASE_URL` is set and PostgreSQL is reachable. If so, offer a one-time migration: read all data from PG, write to filesystem, then proceed. This can be Phase 5 (post-launch).

---

## 18. Implementation Phases

### Phase 1: Interface + Postgres Adapter (Day 1)
- Define `StorageAdapter` interface
- Implement `PostgresAdapter` (wraps existing code)
- Create adapter factory with `ELECTRON` switch
- **Verification**: Run existing tests — everything passes unchanged (web app uses PostgresAdapter)

### Phase 2: Filesystem Adapter (Day 1-2)
- Implement all FS adapter methods
- Write unit tests for each method
- Test data directory creation and atomic writes
- **Verification**: FS adapter unit tests pass

### Phase 3: Rewire Consumers (Day 2-3)
- Replace all `@/lib/db/*` imports with `getStorage()` calls
- Update auth layer for Electron bypass
- Update middleware
- **Verification**: Full test suite passes with both `ELECTRON=1` (FS) and without (Postgres)

### Phase 4: Electron Polish (Day 3-4)
- Update Electron main process (remove PG dependency, set data dir)
- Add auth bypass in frontend
- Add Electron-specific dev scripts
- Manual E2E testing on all platforms
- **Verification**: Full Electron app works without PostgreSQL

### Phase 5: (Future) Data Migration Tool
- One-time PG -> FS migration for existing Electron users
- Optional: FS -> PG export for users switching to web

---

## 19. Decision Log (Needs CTO Input)

| # | Decision | Options | Recommendation |
|---|----------|---------|---------------|
| 1 | **Electron credential storage** | A) Reuse `~/.codex/auth.json` B) Encrypted `user.json` C) OS keychain via `safeStorage` | **A** for MVP, migrate to **C** before production launch |
| 2 | **Rate limiting in Electron** | A) Keep with higher limit B) Disable entirely | **A** — keep as safety net, set `$50/day` default |
| 3 | **Auth in Electron** | A) No auth at all B) Optional local PIN | **A** — match Cursor/VS Code behavior. OS user = trust boundary |
| 4 | **Onboarding in Electron** | A) Skip entirely B) Simplified (just name) C) Full onboarding | **B** — ask name on first launch for personalization |
| 5 | **Dev workflow** | A) Same `dev:next` with ELECTRON env B) Separate electron:dev script | **B** — cleaner separation, no PG required |
| 6 | **Data directory** | A) `app.getPath("userData")` (standard) B) `~/.lumen/` (custom) | **A** — follow platform conventions |
| 7 | **Existing PG users migration** | A) Build migration tool B) Breaking change (start fresh) | **A** but defer to Phase 5. Most Electron users are new |
| 8 | **SQLite instead of JSON files** | A) JSON files B) SQLite via better-sqlite3 | **A** for simplicity. Revisit if performance issues arise with large projects. JSON is easier to debug and inspect |

---

## Appendix A: Lines of Code Estimate

| Component | New Files | Modified Files | Est. New LOC |
|-----------|-----------|----------------|-------------|
| StorageAdapter interface + types | 2 | 0 | ~150 |
| PostgresAdapter | 1 | 0 | ~100 |
| FsAdapter (all sub-modules) | 7 | 0 | ~600 |
| Adapter factory | 1 | 0 | ~30 |
| API route rewiring | 0 | 22 | ~50 (import changes only) |
| Auth layer changes | 0 | 6 | ~80 |
| Engine/agent rewiring | 0 | 3 | ~15 |
| Electron main process | 0 | 2 | ~20 |
| Frontend auth bypass | 0 | 4 | ~30 |
| Tests | 2 | 0 | ~300 |
| **Total** | **13** | **37** | **~1,375** |

## Appendix B: Files That Do NOT Change

- All frontend components (`app/dashboard/[runId]/_components/*`) — zero changes
- All engine pipeline nodes except `persist-project.ts`
- All agent tools except `search-external-persist.ts`
- All LLM prompt files (`lib/agent/prompts/*`, `lib/engine/prompts/*`)
- All discovery modules (`lib/discovery/*`)
- All ingest modules (`lib/ingest/*`)
- Blob store (`lib/storage/blob-store.ts`) — already works locally
- Memory store (`lib/storage/memory-store.ts`) — unchanged
- Electron preload (`electron/preload.ts`) — unchanged
- All landing page components (`app/_components/landing/*`)

---

*End of plan. Ready for CTO review and revision.*
