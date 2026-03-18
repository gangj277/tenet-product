import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import type { LLMMessage } from "@/lib/llm/openrouter";

// ── Proposed Update (file edit / new file) ──

export interface ProposedUpdate {
  id: string;
  type: "edit" | "new";
  key: string;
  label?: string;
  content: string;
  summary: string;
}

// ── Agent Messages ──

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  name: string;
  result: string;
}

// ── Agent Turn Context ──

/** Lightweight metadata per file — used by constitution to build structured file map */
export interface FileMeta {
  group: "core" | "source" | "paper" | "note" | "experiment";
  origin?: "uploaded" | "discovered";
  folder?: string;
}

export interface WorkspaceContext {
  /** Run ID — needed for persisting agent-discovered sources */
  runId?: string;
  /** All workspace file keys → content (artifacts + edited overlays) */
  workspaceFiles: Record<string, string>;
  /** Which file the user currently has open */
  activeFileKey?: string;
  /** File keys available in workspace */
  availableKeys: string[];
  /** Human-readable labels for each key (e.g. source:abc → "Neural Networks in Climate") */
  fileLabels?: Record<string, string>;
  /** Per-file metadata for structured grouping in system prompt */
  fileMeta?: Record<string, FileMeta>;
  /** User-configured search filters for source discovery */
  searchFilters?: SearchFilterConfig;
}

// ── Added Source (agent-discovered, persisted to workspace) ──

export interface AddedSource {
  sourceId: string;
  key: string;                // "source:<uuid>"
  label: string;
  content: string;            // summary markdown
  sourceUrl?: string;
  paperQuality?: PaperQualityMeta;
  folder?: string;
}

// ── SSE Event Types ──

export type SSEEvent =
  | { type: "text_delta"; content: string }
  | { type: "activity"; activity: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "proposed_update"; update: ProposedUpdate }
  | { type: "search_results"; results: DiscoveredSource[] }
  | { type: "sources_added"; sources: AddedSource[] }
  | { type: "skill_activated"; skills: string[] }
  | { type: "error"; message: string }
  | { type: "done"; usage?: { totalTokens: number } };

// ── Agent State (conversation within one turn) ──

export interface AgentState {
  messages: LLMMessage[];
  proposedUpdates: ProposedUpdate[];
  searchResults: DiscoveredSource[];
  activatedSkills: string[];
  totalTokens: number;
  iterations: number;
}
