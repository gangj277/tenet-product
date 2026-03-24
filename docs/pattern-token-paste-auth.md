# Pattern: Token-Paste Authentication for OpenAI Codex Apps

How Lumen authenticates users by having them paste their local Codex `auth.json` into the web app. Reusable for any app that needs OpenAI Codex session tokens from users.

---

## Overview

OpenAI's Codex CLI stores OAuth tokens at `~/.codex/auth.json` after the user runs `codex login`. The file looks like:

```json
{
  "auth_mode": "chatgpt",
  "tokens": {
    "access_token": "eyJhbG...",
    "refresh_token": "oaistb_rt_...",
    "id_token": "eyJhbG...",
    "account_id": "c8504ac2-..."
  }
}
```

Since the Codex CLI's OAuth `client_id` only allows `localhost` redirect URIs, you can't do a standard OAuth redirect flow from a deployed web app. Instead, the user copies this file's contents and pastes it into your app.

---

## Architecture

```
User's machine                          Your web app
┌─────────────┐                    ┌──────────────────┐
│ codex login  │                   │  Login page       │
│      ↓       │                   │  ┌──────────┐    │
│ ~/.codex/    │  user copies &    │  │ textarea  │    │
│  auth.json   │ ──── pastes ────→ │  │ (paste)   │    │
│              │                   │  └──────────┘    │
└─────────────┘                    │       ↓           │
                                   │  POST /api/auth/  │
                                   │  token-paste      │
                                   │       ↓           │
                                   │  Validate tokens  │
                                   │  Create session   │
                                   │  Store encrypted   │
                                   └──────────────────┘
```

---

## Implementation

### 1. API Route: `/api/auth/openai/token-paste/route.ts`

Receives the pasted tokens, validates them against OpenAI, creates a user session.

```ts
import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { connectOpenAIAccount } from "@/lib/auth/openai-account";
import { decodeJwtPayload } from "@/lib/auth/openai-oauth";

interface TokenPasteBody {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
}

export async function POST(request: NextRequest) {
  let body: TokenPasteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accessToken?.trim() || !body.refreshToken?.trim()) {
    return NextResponse.json(
      { error: "accessToken and refreshToken are required" },
      { status: 400 }
    );
  }

  try {
    // Decode JWT to get expiry and account ID
    const claims = decodeJwtPayload(body.accessToken);
    const expiresAt =
      typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 3600_000;
    const accountId =
      (typeof claims.sub === "string" ? claims.sub : "") ||
      (typeof claims.account_id === "string" ? claims.account_id : "");

    // Validate tokens against OpenAI API + create/find user in DB
    const account = await connectOpenAIAccount({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt,
      idToken: body.idToken,
      accountId: accountId || undefined,
    });

    // Create session cookie
    const sessionToken = await createSession({
      userId: account.userId,
      email: account.email,
    });
    await setSessionCookie(sessionToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### 2. JWT Decoder: `lib/auth/openai-oauth.ts`

Extracts claims from the access/id token without verification (the API validation call serves as verification).

```ts
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT format");
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload);
}
```

### 3. Account Connector: `lib/auth/openai-account.ts`

Extracts identity from tokens, creates/finds the user, validates the OpenAI connection works.

```ts
export async function connectOpenAIAccount(
  tokens: OpenAIAccountTokens
): Promise<{ userId: string; email: string }> {
  // Decode tokens to extract identity
  const accessClaims = decodeJwtPayload(tokens.accessToken);
  const idClaims = tokens.idToken ? decodeJwtPayload(tokens.idToken) : {};

  // Extract account ID from nested claims
  const accountId = extractAccountId(accessClaims, idClaims, tokens.accountId);
  const email = extractEmail(accessClaims, idClaims);
  const name = extractName(accessClaims, idClaims, email);

  // Find or create user in DB
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ email, name, authProvider: "openai_auth" })
      .returning({ id: users.id });
    userId = newUser.id;
  }

  // Validate the tokens actually work against OpenAI API
  const validation = await validateOpenAIConnection({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    accountId,
  });

  // Store encrypted tokens for future API calls
  await upsertUserLLMCredentials(userId, {
    kind: "openai_auth",
    access: tokens.accessToken,
    refresh: tokens.refreshToken,
    expires: tokens.expiresAt,
    accountId,
    validation,
  });

  return { userId, email };
}
```

### 4. Token Validation: `lib/llm/openai-connection.ts`

Actually calls the OpenAI API to verify the tokens work.

```ts
export async function validateOpenAIConnection(
  input: OpenAIConnectionInput
): Promise<OpenAIConnectionResult> {
  const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "ChatGPT-Account-Id": input.accountId,
    },
    body: JSON.stringify({
      model: "gpt-5.4",
      instructions: "Reply with the single word ok.",
      stream: true,
      store: false,
      input: [{ role: "user", content: "Reply with the single word ok." }],
    }),
  });

  if (!response.ok) {
    return { ok: false, status: "invalid", ... };
  }

  return { ok: true, status: "valid", ... };
}
```

### 5. Login Page UI: `app/auth/login/page.tsx`

Three modes: auto-detect (local), paste (has Codex), and setup (no Codex).

```tsx
// Key parts of the paste flow:

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group w-full flex items-center justify-between ..."
    >
      <code>{command}</code>
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// Paste mode UI
<CopyCommand command="cat ~/.codex/auth.json | pbcopy" />

<textarea
  value={authJson}
  onChange={(e) => setAuthJson(e.target.value)}
  placeholder="Paste your auth.json contents here..."
/>

<button onClick={handleTokenPaste}>
  Sign in
</button>
```

The submit handler parses the JSON flexibly:

```ts
const handleTokenPaste = async () => {
  const parsed = JSON.parse(authJson.trim());

  // Accept both full auth.json and direct tokens object
  const tokens = (parsed.tokens ?? parsed) as Record<string, unknown>;
  const accessToken =
    (tokens.access_token as string) || (tokens.accessToken as string) || "";
  const refreshToken =
    (tokens.refresh_token as string) || (tokens.refreshToken as string) || "";
  const idToken =
    (tokens.id_token as string) || (tokens.idToken as string) || "";

  const res = await fetch("/api/auth/openai/token-paste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken, idToken }),
  });

  if (res.ok) router.push("/dashboard");
};
```

### 6. Auto-detect Route: `/api/auth/openai/route.ts`

For local/Electron: tries to read the file directly. Falls back to paste mode.

```ts
export async function GET() {
  try {
    // Try local file (works in dev/Electron)
    const localTokens = await readLocalCodexAuthTokens();
    const account = await connectOpenAIAccount(localTokens);
    const session = await createSession(account);
    await setSessionCookie(session);
    return redirect("/dashboard");
  } catch {
    // No local file → redirect to paste mode
    return redirect("/auth/login?mode=paste");
  }
}
```

### 7. Local File Reader: `lib/auth/codex-local-auth.ts`

Reads `~/.codex/auth.json` from disk, refreshes if expired.

```ts
export async function readLocalCodexAuthTokens(): Promise<LocalCodexAuthTokens> {
  const authFilePath = process.env.CODEX_AUTH_FILE
    || path.join(os.homedir(), ".codex", "auth.json");

  const raw = await fs.readFile(authFilePath, "utf8");
  const parsed = JSON.parse(raw);

  // Validate structure
  if (parsed.auth_mode !== "chatgpt") throw new Error("Not signed in");

  const accessToken = parsed.tokens.access_token;
  const refreshToken = parsed.tokens.refresh_token;
  const idToken = parsed.tokens.id_token;
  const accountId = parsed.tokens.account_id;

  // Refresh if expired
  let currentAccessToken = accessToken;
  let expiresAt = getTokenExpiryMs(currentAccessToken);
  if (expiresAt - Date.now() < 30_000) {
    const refreshed = await refreshAccessToken(refreshToken);
    currentAccessToken = refreshed.access_token;
    expiresAt = Date.now() + refreshed.expires_in * 1000;
  }

  return { accessToken: currentAccessToken, refreshToken, idToken, accountId, expiresAt };
}
```

---

## Token Structure Reference

### access_token (JWT)
```json
{
  "aud": ["https://api.openai.com/v1"],
  "client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
  "exp": 1775210930,
  "https://api.openai.com/auth": {
    "chatgpt_account_id": "c8504ac2-...",
    "chatgpt_plan_type": "pro",
    "chatgpt_user_id": "user-s10wSCoQaaRWgDpmbMTagSM3",
    "localhost": true,
    "user_id": "user-s10wSCoQaaRWgDpmbMTagSM3"
  },
  "https://api.openai.com/profile": {
    "email": "user@gmail.com",
    "email_verified": true
  },
  "sub": "google-oauth2|105051470486395699664"
}
```

### id_token (JWT)
```json
{
  "email": "user@gmail.com",
  "email_verified": true,
  "name": "User Name",
  "https://api.openai.com/auth": {
    "chatgpt_account_id": "c8504ac2-...",
    "chatgpt_plan_type": "pro",
    "organizations": [
      { "id": "org-...", "role": "owner", "title": "Personal" }
    ]
  },
  "sub": "google-oauth2|105051470486395699664"
}
```

### refresh_token
Opaque string: `oaistb_rt_8Ccu6CdZs...`. Used to get new access tokens via:

```ts
const response = await fetch("https://auth0.openai.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
    refresh_token: refreshToken,
  }),
});
```

---

## Security Considerations

1. **Tokens are encrypted at rest** — stored in DB via `encryptTokens()` using AES-256-GCM with `ENCRYPTION_KEY` env var
2. **Tokens are validated on paste** — the API route calls OpenAI to verify the token works before creating a session
3. **Session is HTTP-only cookie** — the pasted tokens are never stored in the browser, only on the server
4. **Refresh tokens rotate** — when refreshed, the old token is replaced

---

## Adapting for Another App

To reuse this pattern:

1. **Copy these files**:
   - `app/api/auth/openai/token-paste/route.ts` — the paste endpoint
   - `lib/auth/openai-oauth.ts` — JWT decode + token refresh
   - `lib/auth/codex-local-auth.ts` — local file reader
   - `lib/llm/openai-connection.ts` — token validation

2. **Adapt `connectOpenAIAccount`** for your user model (the identity extraction is reusable)

3. **Build a paste UI** with:
   - Click-to-copy `cat ~/.codex/auth.json | pbcopy` command
   - Textarea for paste
   - Flexible JSON parser (accept both `{ tokens: { ... } }` and `{ access_token: ... }`)

4. **The validation endpoint** (`chatgpt.com/backend-api/codex/responses`) is the Codex Responses API — change the model/prompt to whatever you need

5. **For Electron**: try local file first, fall back to paste. For web-only: always use paste.
