/**
 * Agent token-usage diagnostic.
 *
 * This script runs two complementary checks using a real connected OpenAI-auth user:
 *
 * 1. A raw Codex Responses API request that logs the full `response.usage` object
 * 2. A real `runAgentLoop()` inference that captures the final `done.usage`
 *
 * It then compares those provider-reported counts with the app's local
 * next-turn context estimate so we can see whether we are mixing up:
 *
 * - per-call provider accounting
 * - next-turn live context size
 *
 * Usage:
 *   npx tsx scripts/test-agent-token-usage.ts
 *   npx tsx scripts/test-agent-token-usage.ts --email you@example.com
 *   npx tsx scripts/test-agent-token-usage.ts --message "Read the overview and answer in 2 bullets."
 *   npx tsx scripts/test-agent-token-usage.ts --skip-raw
 *   npx tsx scripts/test-agent-token-usage.ts --skip-agent
 */

import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";

import { MODEL_AGENT } from "../lib/llm/models";
import { CODEX_RESPONSES_URL } from "../lib/llm/config";
import type { LLMMessage } from "../lib/llm/runtime";
import type { TokenUsage, WorkspaceContext } from "../lib/agent/state";
import type { ChatMessage } from "../app/dashboard/[runId]/_lib/workspace-types";

const DEFAULT_MESSAGE =
  "Read the overview and synthesis files, then answer in exactly two bullet points.";
const DEFAULT_MODEL = MODEL_AGENT;
const DEFAULT_OUTPUT_DIR = "artifacts/diagnostics/agent-token-usage";

interface CliOptions {
  email?: string;
  userId?: string;
  message: string;
  model: string;
  outputDir: string;
  skipRaw: boolean;
  skipAgent: boolean;
}

interface ResolvedUser {
  userId: string;
  email: string;
  validationStatus: string;
  validatedAt?: string | null;
  capabilities: Record<string, boolean>;
}

interface RuntimeDeps {
  db: typeof import("../lib/db/client").db;
  users: typeof import("../lib/db/schema").users;
  userLlmCredentials: typeof import("../lib/db/schema").userLlmCredentials;
  ensureOpenAIProviderAccess: typeof import("../lib/llm/openai-access").ensureOpenAIProviderAccess;
  getUserLLMCredentials: typeof import("../lib/db/user-credentials").getUserLLMCredentials;
  upsertUserLLMCredentials: typeof import("../lib/db/user-credentials").upsertUserLLMCredentials;
  refreshAccessToken: typeof import("../lib/auth/openai-oauth").refreshAccessToken;
  runAgentLoop: typeof import("../lib/agent/graph").runAgentLoop;
  buildSystemPrompt: typeof import("../lib/agent/prompts/constitution").buildSystemPrompt;
  estimatePromptTokensForMessages: typeof import("../lib/agent/compaction").estimatePromptTokensForMessages;
  deriveChatContinuationState: typeof import("../lib/agent/chat-context").deriveChatContinuationState;
  estimateLiveContextUsage: typeof import("../lib/agent/chat-context").estimateLiveContextUsage;
  getToolSchemas: typeof import("../lib/agent/tools").getToolSchemas;
}

interface RefreshedCredentials {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}

interface RawResponsesSummary {
  requestBodyPath: string;
  eventLogPath: string;
  eventTypes: Record<string, number>;
  outputTextChars: number;
  toolCallCount: number;
  completedUsage: Record<string, unknown> | null;
  normalizedUsage: TokenUsage | null;
  model: string | null;
}

interface AgentRunSummary {
  eventTypes: Record<string, number>;
  toolCallCount: number;
  outputTextChars: number;
  compactionEvents: Array<{
    scope: "history" | "turn";
    estimatedTokensBefore: number;
    estimatedTokensAfter: number;
  }>;
  doneUsage: TokenUsage | null;
  nextTurnEstimate: number;
  nextTurnThreshold: number;
  nextTurnStatus: string;
  nextTurnMinusLastInferencePromptTokens: number | null;
}

let runtimeDeps: RuntimeDeps | null = null;

void main().catch((error) => {
  console.error(`Fatal: ${(error as Error).message}`);
  process.exit(1);
});

async function main() {
  loadLocalEnv();
  runtimeDeps = await loadRuntimeDeps();

  const options = parseArgs(process.argv.slice(2));
  const user = await resolveUser(options);
  await getRuntimeDeps().ensureOpenAIProviderAccess(user.userId);
  const provider = await getRuntimeDeps().ensureOpenAIProviderAccess(user.userId);
  const creds = await ensureFreshCredentials(user.userId);
  const workspaceCtx = buildWorkspaceContext();
  const llmMessages = buildInitialMessages(options.message, workspaceCtx);
  const tools = getRuntimeDeps().getToolSchemas([]);
  const estimatedInitialPromptTokens =
    getRuntimeDeps().estimatePromptTokensForMessages(llmMessages, tools);

  const outputDir = prepareOutputDir(options.outputDir, options.message);

  console.log("\n=== Agent Token Usage Diagnostic ===");
  console.log(`User: ${user.email} (${user.userId})`);
  console.log(`Credential status: ${user.validationStatus}`);
  console.log(`Model: ${options.model}`);
  console.log(`Message: ${options.message}`);
  console.log(`Estimated initial prompt tokens: ~${estimatedInitialPromptTokens.toLocaleString()}`);
  console.log(`Output dir: ${outputDir}`);

  let rawSummary: RawResponsesSummary | null = null;
  if (!options.skipRaw) {
    rawSummary = await runRawResponsesDiagnostic({
      creds,
      model: options.model,
      messages: llmMessages,
      outputDir,
      tools,
    });
  }

  let agentSummary: AgentRunSummary | null = null;
  if (!options.skipAgent) {
    agentSummary = await runAgentDiagnostic({
      provider,
      model: options.model,
      message: options.message,
      workspaceCtx,
    });
  }

  const recommendation = buildRecommendation(rawSummary, agentSummary);
  const summary = {
    generatedAt: new Date().toISOString(),
    user,
    model: options.model,
    message: options.message,
    estimatedInitialPromptTokens,
    rawResponses: rawSummary,
    agentRun: agentSummary,
    recommendation,
  };

  const summaryPath = path.join(outputDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("\n=== Observations ===");
  if (rawSummary) {
    console.log(
      `Raw Responses usage: ${formatUsage(rawSummary.normalizedUsage)}`
    );
    console.log(
      `Raw completed usage object keys: ${rawSummary.completedUsage ? Object.keys(rawSummary.completedUsage).join(", ") : "none"}`
    );
  }
  if (agentSummary) {
    console.log(`Agent done usage:      ${formatUsage(agentSummary.doneUsage)}`);
    console.log(
      `Next-turn estimate:    ~${agentSummary.nextTurnEstimate.toLocaleString()} / ${agentSummary.nextTurnThreshold.toLocaleString()} (${agentSummary.nextTurnStatus})`
    );
    if (agentSummary.nextTurnMinusLastInferencePromptTokens !== null) {
      console.log(
        `Estimate - last prompt: ${formatSigned(
          agentSummary.nextTurnMinusLastInferencePromptTokens
        )}`
      );
    }
    console.log(`Agent tool calls:     ${agentSummary.toolCallCount}`);
  }
  console.log(`Recommendation:       ${recommendation}`);
  console.log(`Summary:              ${summaryPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    message: DEFAULT_MESSAGE,
    model: DEFAULT_MODEL,
    outputDir: DEFAULT_OUTPUT_DIR,
    skipRaw: false,
    skipAgent: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--email" && next) {
      options.email = next.trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === "--user-id" && next) {
      options.userId = next;
      i += 1;
      continue;
    }
    if (arg === "--message" && next) {
      options.message = next;
      i += 1;
      continue;
    }
    if (arg === "--model" && next) {
      options.model = next;
      i += 1;
      continue;
    }
    if (arg === "--output-dir" && next) {
      options.outputDir = next;
      i += 1;
      continue;
    }
    if (arg === "--skip-raw") {
      options.skipRaw = true;
      continue;
    }
    if (arg === "--skip-agent") {
      options.skipAgent = true;
      continue;
    }
  }

  return options;
}

function loadLocalEnv() {
  for (const filename of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    const contents = fs.readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = line.slice(0, separatorIndex).trim();
      if (process.env[key]) continue;

      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [
    { db },
    { users, userLlmCredentials },
    access,
    userCredentials,
    oauth,
    agentGraph,
    constitution,
    compaction,
    chatContext,
    tools,
  ] = await Promise.all([
    import("../lib/db/client"),
    import("../lib/db/schema"),
    import("../lib/llm/openai-access"),
    import("../lib/db/user-credentials"),
    import("../lib/auth/openai-oauth"),
    import("../lib/agent/graph"),
    import("../lib/agent/prompts/constitution"),
    import("../lib/agent/compaction"),
    import("../lib/agent/chat-context"),
    import("../lib/agent/tools"),
  ]);

  return {
    db,
    users,
    userLlmCredentials,
    ensureOpenAIProviderAccess: access.ensureOpenAIProviderAccess,
    getUserLLMCredentials: userCredentials.getUserLLMCredentials,
    upsertUserLLMCredentials: userCredentials.upsertUserLLMCredentials,
    refreshAccessToken: oauth.refreshAccessToken,
    runAgentLoop: agentGraph.runAgentLoop,
    buildSystemPrompt: constitution.buildSystemPrompt,
    estimatePromptTokensForMessages: compaction.estimatePromptTokensForMessages,
    deriveChatContinuationState: chatContext.deriveChatContinuationState,
    estimateLiveContextUsage: chatContext.estimateLiveContextUsage,
    getToolSchemas: tools.getToolSchemas,
  };
}

function getRuntimeDeps(): RuntimeDeps {
  if (!runtimeDeps) {
    throw new Error("Runtime dependencies are not loaded.");
  }
  return runtimeDeps;
}

async function resolveUser(options: CliOptions): Promise<ResolvedUser> {
  const { db, users, userLlmCredentials } = getRuntimeDeps();

  if (options.userId) {
    const [row] = await db
      .select({
        userId: users.id,
        email: users.email,
        validationStatus: userLlmCredentials.validationStatus,
        validatedAt: userLlmCredentials.validatedAt,
        capabilities: userLlmCredentials.capabilities,
      })
      .from(users)
      .innerJoin(userLlmCredentials, eq(users.id, userLlmCredentials.userId))
      .where(eq(users.id, options.userId))
      .limit(1);

    if (!row) {
      throw new Error(
        `No connected OpenAI-auth credentials found for user id ${options.userId}.`
      );
    }

    return {
      userId: row.userId,
      email: row.email,
      validationStatus: row.validationStatus,
      validatedAt: row.validatedAt?.toISOString() ?? null,
      capabilities: row.capabilities ?? {},
    };
  }

  if (options.email) {
    const [row] = await db
      .select({
        userId: users.id,
        email: users.email,
        validationStatus: userLlmCredentials.validationStatus,
        validatedAt: userLlmCredentials.validatedAt,
        capabilities: userLlmCredentials.capabilities,
      })
      .from(users)
      .innerJoin(userLlmCredentials, eq(users.id, userLlmCredentials.userId))
      .where(eq(users.email, options.email))
      .limit(1);

    if (!row) {
      throw new Error(
        `No connected OpenAI-auth credentials found for ${options.email}.`
      );
    }

    return {
      userId: row.userId,
      email: row.email,
      validationStatus: row.validationStatus,
      validatedAt: row.validatedAt?.toISOString() ?? null,
      capabilities: row.capabilities ?? {},
    };
  }

  const [row] = await db
    .select({
      userId: userLlmCredentials.userId,
      email: users.email,
      validationStatus: userLlmCredentials.validationStatus,
      validatedAt: userLlmCredentials.validatedAt,
      capabilities: userLlmCredentials.capabilities,
    })
    .from(userLlmCredentials)
    .innerJoin(users, eq(users.id, userLlmCredentials.userId))
    .orderBy(desc(userLlmCredentials.updatedAt))
    .limit(1);

  if (!row) {
    throw new Error("No connected OpenAI-auth credentials found.");
  }

  return {
    userId: row.userId,
    email: row.email,
    validationStatus: row.validationStatus,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    capabilities: row.capabilities ?? {},
  };
}

async function ensureFreshCredentials(
  userId: string
): Promise<RefreshedCredentials> {
  const deps = getRuntimeDeps();
  const creds = await deps.getUserLLMCredentials(userId);
  if (!creds) {
    throw new Error(`No OpenAI-auth credentials found for ${userId}.`);
  }

  if (creds.expires - Date.now() >= 30_000) {
    return {
      access: creds.access,
      refresh: creds.refresh,
      expires: creds.expires,
      accountId: creds.accountId,
    };
  }

  const refreshed = await deps.refreshAccessToken(creds.refresh);
  const nextCreds = {
    ...creds,
    access: refreshed.access_token,
    refresh: refreshed.refresh_token || creds.refresh,
    expires: Date.now() + refreshed.expires_in * 1000,
  };
  await deps.upsertUserLLMCredentials(userId, nextCreds);

  return {
    access: nextCreds.access,
    refresh: nextCreds.refresh,
    expires: nextCreds.expires,
    accountId: nextCreds.accountId,
  };
}

function buildWorkspaceContext(): WorkspaceContext {
  const workspaceFiles = {
    overview: [
      "# Overview",
      "Lumen is a research workspace that ingests sources, synthesizes findings, and helps users draft artifacts.",
      "The chat agent can inspect workspace files, suggest edits, and compact prior conversation state.",
    ].join("\n\n"),
    synthesis: [
      "# Synthesis",
      "- The current implementation estimates live context locally.",
      "- Provider usage from the last inference is also stored for diagnostics.",
    ].join("\n\n"),
    claims: "# Claims\n\n- Context usage must reflect the next-turn prompt, not the previous internal tool loop.",
    gaps: "# Gaps\n\n- The current estimator is approximate and should be compared against provider usage, not replaced by it.",
    nextSteps: "# Next Steps\n\n- Build diagnostics for token accounting.\n- Separate per-call usage from live-context estimates.",
  };

  return {
    runId: "diagnostic-run",
    workspaceFiles,
    activeFileKey: "overview",
    availableKeys: Object.keys(workspaceFiles),
    folderPaths: ["Core"],
    fileLabels: {
      overview: "Overview",
      synthesis: "Synthesis",
      claims: "Claims",
      gaps: "Gaps",
      nextSteps: "Next Steps",
    },
    fileMeta: {
      overview: { group: "core" },
      synthesis: { group: "core" },
      claims: { group: "core" },
      gaps: { group: "core" },
      nextSteps: { group: "core" },
    },
  };
}

function buildInitialMessages(
  message: string,
  workspaceCtx: WorkspaceContext
): LLMMessage[] {
  const systemPrompt = getRuntimeDeps().buildSystemPrompt(workspaceCtx, []);
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];
}

async function runRawResponsesDiagnostic(input: {
  creds: RefreshedCredentials;
  model: string;
  messages: LLMMessage[];
  outputDir: string;
  tools: ReturnType<RuntimeDeps["getToolSchemas"]>;
}): Promise<RawResponsesSummary> {
  const requestBody = toResponsesRequestBody(
    input.messages,
    input.tools,
    input.model
  );
  const requestBodyPath = path.join(input.outputDir, "raw-request.json");
  const eventLogPath = path.join(input.outputDir, "raw-events.jsonl");
  fs.writeFileSync(requestBodyPath, JSON.stringify(requestBody, null, 2), "utf8");

  const response = await fetch(CODEX_RESPONSES_URL, {
    method: "POST",
    headers: buildResponsesHeaders(input.creds),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    throw new Error(
      `Raw Responses request failed (${response.status}): ${errorBody}`
    );
  }

  const eventTypes: Record<string, number> = {};
  let outputTextChars = 0;
  let toolCallCount = 0;
  let completedUsage: Record<string, unknown> | null = null;
  let normalizedUsage: TokenUsage | null = null;
  let responseModel: string | null = null;
  const eventLog = fs.createWriteStream(eventLogPath, { encoding: "utf8" });

  try {
    for await (const event of parseResponsesSSE(response.body)) {
      eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
      eventLog.write(`${JSON.stringify(event)}\n`);

      if (event.type === "response.output_text.delta") {
        outputTextChars +=
          ((event.data as { delta?: string }).delta ?? "").length;
      } else if (event.type === "response.output_item.added") {
        const item = (event.data as { item?: Record<string, unknown> }).item;
        if (item?.type === "function_call") {
          toolCallCount += 1;
        }
      } else if (event.type === "response.completed") {
        const responsePayload = (event.data as { response?: Record<string, unknown> })
          .response;
        if (responsePayload?.usage) {
          completedUsage = responsePayload.usage as Record<string, unknown>;
          const usage = completedUsage as Record<string, number>;
          normalizedUsage = {
            promptTokens: usage.input_tokens ?? 0,
            completionTokens: usage.output_tokens ?? 0,
            totalTokens:
              (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          };
        }
        if (typeof responsePayload?.model === "string") {
          responseModel = responsePayload.model;
        }
      }
    }
  } finally {
    eventLog.end();
  }

  return {
    requestBodyPath,
    eventLogPath,
    eventTypes,
    outputTextChars,
    toolCallCount,
    completedUsage,
    normalizedUsage,
    model: responseModel,
  };
}

async function runAgentDiagnostic(input: {
  provider: Awaited<ReturnType<RuntimeDeps["ensureOpenAIProviderAccess"]>>;
  model: string;
  message: string;
  workspaceCtx: WorkspaceContext;
}): Promise<AgentRunSummary> {
  const eventTypes: Record<string, number> = {};
  const compactionEvents: AgentRunSummary["compactionEvents"] = [];
  let toolCallCount = 0;
  let outputText = "";
  let doneUsage: TokenUsage | null = null;
  let historySnapshot:
    | {
        version: 1;
        activatedSkills: string[];
        compactedMessageCount: number;
        summary: string;
        keyFacts: string[];
        openLoops: string[];
        nextStepHint?: string;
        estimatedTokensAfter: number;
        compactedAt: string;
      }
    | undefined;
  let activatedSkills: string[] = [];
  let taskPlan:
    | Array<{ id: string; objective: string; status: "pending" | "active" | "completed"; result?: string }>
    | undefined;

  for await (const event of getRuntimeDeps().runAgentLoop(
    input.message,
    [],
    input.workspaceCtx,
    undefined,
    input.model,
    input.provider,
    "medium"
  )) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;

    if (event.type === "text_delta") {
      outputText += event.content;
    } else if (event.type === "tool_call") {
      toolCallCount += 1;
    } else if (event.type === "context_compacted") {
      compactionEvents.push({
        scope: event.scope,
        estimatedTokensBefore: event.estimatedTokensBefore,
        estimatedTokensAfter: event.estimatedTokensAfter,
      });
      if (event.scope === "history" && event.snapshot) {
        historySnapshot = event.snapshot;
      }
    } else if (event.type === "skill_activated") {
      activatedSkills = Array.from(new Set([...activatedSkills, ...event.skills]));
    } else if (event.type === "task_plan") {
      taskPlan = event.tasks;
    } else if (event.type === "done") {
      doneUsage = event.usage ?? null;
    }
  }

  const chatMessages: ChatMessage[] = [
    {
      id: "diag-user-1",
      role: "user",
      text: input.message,
      timestamp: Date.now(),
    },
    {
      id: "diag-agent-1",
      role: "agent",
      text: outputText,
      timestamp: Date.now() + 1,
      ...(doneUsage ? { providerUsage: doneUsage } : {}),
      ...(historySnapshot ? { compactionSnapshot: historySnapshot } : {}),
      ...(activatedSkills.length > 0 ? { activatedSkills } : {}),
      ...(taskPlan ? { taskPlan } : {}),
    },
  ];

  const continuation =
    getRuntimeDeps().deriveChatContinuationState(chatMessages);
  const nextTurnUsage = getRuntimeDeps().estimateLiveContextUsage({
    messages: chatMessages,
    continuation,
    workspaceContext: input.workspaceCtx,
  });

  return {
    eventTypes,
    toolCallCount,
    outputTextChars: outputText.length,
    compactionEvents,
    doneUsage,
    nextTurnEstimate: nextTurnUsage.estimatedLiveContextTokens,
    nextTurnThreshold: nextTurnUsage.compactionThresholdTokens,
    nextTurnStatus: nextTurnUsage.compactionStatus,
    nextTurnMinusLastInferencePromptTokens:
      doneUsage?.promptTokens != null
        ? nextTurnUsage.estimatedLiveContextTokens - doneUsage.promptTokens
        : null,
  };
}

function buildRecommendation(
  rawSummary: RawResponsesSummary | null,
  agentSummary: AgentRunSummary | null
): string {
  if (!agentSummary) {
    return "Use the raw Responses usage only as per-call accounting. Keep live-context estimation local and next-turn based.";
  }

  const delta = agentSummary.nextTurnMinusLastInferencePromptTokens;
  if (agentSummary.toolCallCount > 0) {
    return "Do not use provider promptTokens as the chat ring's live-context count. Tool-call turns make the last provider usage reflect an internal inference step, not the next-turn prompt. Keep provider usage as diagnostics only.";
  }

  if (delta !== null && Math.abs(delta) >= 500) {
    return "Do not overwrite the next-turn estimate with provider promptTokens. The provider value is materially different from the future live prompt size for this run.";
  }

  if (rawSummary?.completedUsage) {
    return "The raw API usage object is suitable for per-call accounting, but it should remain separate from next-turn live-context estimation.";
  }

  return "Keep provider usage separate from live-context estimation. Use the local estimate for compaction/UI and provider usage for diagnostics and billing.";
}

function toResponsesRequestBody(
  messages: LLMMessage[],
  tools: ReturnType<RuntimeDeps["getToolSchemas"]>,
  model: string
) {
  const { instructions, input } = extractSystemAndInput(messages);
  return {
    model,
    instructions,
    input,
    tools: tools.map((tool) => ({
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    })),
    store: false,
    stream: true,
  };
}

function extractSystemAndInput(messages: LLMMessage[]): {
  instructions: string;
  input: Array<Record<string, unknown>>;
} {
  let instructions = "You are a helpful assistant.";
  const input: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === "system") {
      instructions =
        typeof message.content === "string" ? message.content : instructions;
      continue;
    }

    if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id ?? "",
        output:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content),
      });
      continue;
    }

    if (message.role === "assistant" && message.tool_calls?.length) {
      for (const toolCall of message.tool_calls) {
        input.push({
          type: "function_call",
          call_id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        });
      }
      if (message.content) {
        input.push({
          role: "assistant",
          content: message.content,
        });
      }
      continue;
    }

    input.push({
      role: message.role,
      content: message.content ?? "",
    });
  }

  return { instructions, input };
}

function buildResponsesHeaders(creds: RefreshedCredentials) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.access}`,
    "Content-Type": "application/json",
  };

  if (creds.accountId) {
    headers["ChatGPT-Account-Id"] = creds.accountId;
  }

  return headers;
}

async function* parseResponsesSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<{ type: string; data: Record<string, unknown> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
          continue;
        }
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            yield { type: currentEvent || data.type || "", data };
          } catch {
            // Skip malformed SSE frames in diagnostics.
          }
          continue;
        }
        if (trimmed === "") {
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function prepareOutputDir(baseOutputDir: string, message: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "run";
  const outputDir = path.join(baseOutputDir, `${timestamp}-${slug}`);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function formatUsage(usage: TokenUsage | null): string {
  if (!usage) return "none";
  return `${usage.promptTokens.toLocaleString()} prompt + ${usage.completionTokens.toLocaleString()} completion = ${usage.totalTokens.toLocaleString()} total`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}
