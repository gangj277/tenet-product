import { MODEL_AGENT, MODEL_LITE } from "@/lib/llm/models";
import type { LLMProvider } from "@/lib/llm/provider";
import type { ContentPart, LLMMessage } from "@/lib/llm/runtime";
import { callLLMJsonWith } from "@/lib/llm/json";
import { estimateTokens } from "@/lib/ingest/document-quality";
import {
  SKILL_REFERENCE_TOOL,
  TOOL_SCHEMAS,
} from "./tools/tool-schemas";
import type { ToolDefinition } from "./tools/tool-types";
import type {
  CompactionSnapshot,
  SSEEvent,
  TaskPlan,
} from "./state";

export const COMPACTION_THRESHOLD_TOKENS = 250_000;
export const COMPACTION_TARGET_TOKENS = 120_000;
export const COMPACTION_PROTECTED_SUFFIX_MESSAGES = 6;

const COMPACTION_SCHEMA = {
  name: "context_compaction_snapshot",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      keyFacts: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 10,
      },
      openLoops: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
      },
      nextStepHint: { type: "string" },
    },
    required: ["summary", "keyFacts", "openLoops"],
    additionalProperties: false,
  },
} as const;

interface SummaryPayload {
  summary: string;
  keyFacts: string[];
  openLoops: string[];
  nextStepHint?: string;
}

export interface CompactMessagesOptions {
  messages: LLMMessage[];
  provider: LLMProvider;
  activeSkills: string[];
  taskPlan?: TaskPlan;
  historyVisibleMessageCount: number;
  currentTurnStartIndex: number;
  thresholdTokens?: number;
  targetTokens?: number;
  protectedSuffixMessages?: number;
}

export interface CompactMessagesResult {
  messages: LLMMessage[];
  historySnapshot?: CompactionSnapshot;
  currentTurnStartIndex: number;
  events: Array<
    Extract<SSEEvent, { type: "context_compacted" }>
  >;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
}

function normalizeContentPart(part: ContentPart): Record<string, unknown> {
  switch (part.type) {
    case "text":
    case "input_text":
      return { type: part.type, text: part.text };
    case "image_url":
      return { type: "image_url", image_url: "[image omitted]" };
    case "input_file":
      return {
        type: "input_file",
        filename: part.filename ?? "[file]",
        file_id: part.file_id ?? undefined,
        file_url: part.file_url ?? undefined,
        file_data: part.file_data ? "[file bytes omitted]" : undefined,
      };
  }
}

function normalizeContent(
  content: string | ContentPart[] | null
): string | Array<Record<string, unknown>> | null {
  if (typeof content === "string" || content === null) return content;
  return content.map(normalizeContentPart);
}

function toResponsesStylePayload(
  messages: LLMMessage[],
  tools?: ToolDefinition[]
): Record<string, unknown> {
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
            : JSON.stringify(normalizeContent(message.content)),
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
          content: normalizeContent(message.content),
        });
      }
      continue;
    }

    input.push({
      role: message.role,
      content: normalizeContent(message.content),
    });
  }

  return {
    instructions,
    input,
    tools: tools?.map((tool) => ({
      type: tool.type,
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    })),
  };
}

function getApproximateTools(activeSkills: string[]): ToolDefinition[] {
  return activeSkills.length > 0
    ? [...TOOL_SCHEMAS, SKILL_REFERENCE_TOOL]
    : TOOL_SCHEMAS;
}

export function estimatePromptTokensForMessages(
  messages: LLMMessage[],
  tools: ToolDefinition[] = TOOL_SCHEMAS
): number {
  return estimateTokens(JSON.stringify(toResponsesStylePayload(messages, tools)));
}

function serializeMessageForCompaction(message: LLMMessage): string {
  const parts: string[] = [`role=${message.role}`];

  if (typeof message.content === "string" && message.content.trim()) {
    parts.push(message.content);
  } else if (Array.isArray(message.content)) {
    const rendered = message.content
      .map((part) => {
        if (part.type === "text" || part.type === "input_text") {
          return part.text;
        }
        if (part.type === "image_url") {
          return "[image attachment]";
        }
        return `[file attachment${part.filename ? `: ${part.filename}` : ""}]`;
      })
      .join("\n");
    if (rendered.trim()) {
      parts.push(rendered);
    }
  }

  if (message.tool_calls?.length) {
    parts.push(
      `tool_calls=${message.tool_calls
        .map(
          (toolCall) =>
            `${toolCall.function.name}(${toolCall.function.arguments})`
        )
        .join("; ")}`
    );
  }

  if (message.role === "tool") {
    parts.push(`tool_call_id=${message.tool_call_id ?? ""}`);
  }

  return parts.join("\n");
}

async function summarizeMessages(
  provider: LLMProvider,
  messages: LLMMessage[],
  targetTokens: number
): Promise<SummaryPayload> {
  const prompt = messages
    .map((message, index) => `## Message ${index + 1}\n${serializeMessageForCompaction(message)}`)
    .join("\n\n");

  const options = {
    model: MODEL_LITE,
    reasoningEffort: "low" as const,
    temperature: 0.1,
    maxTokens: 1200,
    jsonSchema: COMPACTION_SCHEMA,
    messages: [
      {
        role: "system" as const,
        content:
          "You condense prior agent context into durable working memory. Preserve facts, unresolved threads, and the next logical action. Do not narrate process. Return only JSON.",
      },
      {
        role: "user" as const,
        content: [
          `Target compacted prompt budget: ~${targetTokens} tokens.`,
          "Summarize the following conversation state for future continuation.",
          prompt,
        ].join("\n\n"),
      },
    ],
  };

  try {
    const { data } = await callLLMJsonWith<SummaryPayload>(provider, options);
    return data;
  } catch {
    const { data } = await callLLMJsonWith<SummaryPayload>(provider, {
      ...options,
      model: MODEL_AGENT,
    });
    return data;
  }
}

export function renderCompactionMemoryMessage(
  snapshot: CompactionSnapshot,
  extras?: {
    activeSkills?: string[];
    taskPlan?: TaskPlan;
    pendingProposedUpdates?: Array<{ key: string; summary: string }>;
    pendingQuestions?: string[];
    heading?: string;
  }
): string {
  const heading = extras?.heading ?? "Compacted memory";
  const activeSkills = extras?.activeSkills ?? snapshot.activatedSkills;
  const taskPlan = extras?.taskPlan ?? snapshot.taskPlan;
  const lines = [heading, `Summary: ${snapshot.summary}`, "", "Key facts:"];

  for (const fact of snapshot.keyFacts) {
    lines.push(`- ${fact}`);
  }

  if (snapshot.openLoops.length > 0) {
    lines.push("", "Open loops:");
    for (const loop of snapshot.openLoops) {
      lines.push(`- ${loop}`);
    }
  }

  if (snapshot.nextStepHint) {
    lines.push("", `Next step hint: ${snapshot.nextStepHint}`);
  }

  if (activeSkills.length > 0) {
    lines.push("", `Activated skills: ${activeSkills.join(", ")}`);
  }

  if (taskPlan?.tasks.length) {
    lines.push("", "Task plan:");
    for (const task of taskPlan.tasks) {
      lines.push(`- [${task.status}] ${task.objective}`);
    }
  }

  if (extras?.pendingProposedUpdates?.length) {
    lines.push("", "Pending proposed updates:");
    for (const update of extras.pendingProposedUpdates) {
      lines.push(`- ${update.key}: ${update.summary}`);
    }
  }

  if (extras?.pendingQuestions?.length) {
    lines.push("", "Pending user questions:");
    for (const question of extras.pendingQuestions) {
      lines.push(`- ${question}`);
    }
  }

  return lines.join("\n");
}

function buildSnapshot(
  summary: SummaryPayload,
  compactedMessageCount: number,
  activeSkills: string[],
  taskPlan: TaskPlan | undefined,
  estimatedTokensAfter: number
): CompactionSnapshot {
  return {
    version: 1,
    compactedMessageCount,
    summary: summary.summary,
    keyFacts: summary.keyFacts,
    openLoops: summary.openLoops,
    ...(summary.nextStepHint ? { nextStepHint: summary.nextStepHint } : {}),
    activatedSkills: activeSkills,
    ...(taskPlan ? { taskPlan } : {}),
    estimatedTokensAfter,
    compactedAt: new Date().toISOString(),
  };
}

function adjustProtectedSuffixStart(
  messages: LLMMessage[],
  startIndex: number,
  minimumIndex: number
): number {
  let adjusted = startIndex;

  while (adjusted > minimumIndex) {
    const current = messages[adjusted];
    const previous = messages[adjusted - 1];

    if (
      current?.role === "tool" &&
      previous?.role === "assistant" &&
      previous.tool_calls?.some(
        (toolCall) => toolCall.id === current.tool_call_id
      )
    ) {
      adjusted -= 1;
      continue;
    }

    break;
  }

  return adjusted;
}

function getTurnCompactionStartIndex(
  messages: LLMMessage[],
  currentTurnStartIndex: number,
  protectedSuffixMessages: number
): number {
  let visibleCount = 0;
  let startIndex = messages.length;

  for (let index = messages.length - 1; index >= currentTurnStartIndex; index -= 1) {
    if (messages[index]?.role === "system") continue;
    visibleCount += 1;
    if (visibleCount >= protectedSuffixMessages) {
      startIndex = index;
      break;
    }
  }

  if (startIndex === messages.length) {
    return currentTurnStartIndex;
  }

  return adjustProtectedSuffixStart(
    messages,
    startIndex,
    currentTurnStartIndex
  );
}

export async function compactMessagesToFitBudget(
  options: CompactMessagesOptions
): Promise<CompactMessagesResult> {
  const thresholdTokens =
    options.thresholdTokens ?? COMPACTION_THRESHOLD_TOKENS;
  const targetTokens = options.targetTokens ?? COMPACTION_TARGET_TOKENS;
  const protectedSuffixMessages =
    options.protectedSuffixMessages ?? COMPACTION_PROTECTED_SUFFIX_MESSAGES;

  const tools = getApproximateTools(options.activeSkills);
  const estimatedTokensBefore = estimatePromptTokensForMessages(
    options.messages,
    tools
  );

  let estimatedTokensAfter = estimatedTokensBefore;
  let nextMessages = [...options.messages];
  let currentTurnStartIndex = options.currentTurnStartIndex;
  let historySnapshot: CompactionSnapshot | undefined;
  const events: CompactMessagesResult["events"] = [];

  if (
    estimatedTokensAfter > thresholdTokens &&
    currentTurnStartIndex > 1 &&
    nextMessages.slice(1, currentTurnStartIndex).length > 0
  ) {
    const historySlice = nextMessages.slice(1, currentTurnStartIndex);
    const historySummary = await summarizeMessages(
      options.provider,
      historySlice,
      targetTokens
    );
    const provisionalSnapshot = buildSnapshot(
      historySummary,
      options.historyVisibleMessageCount || historySlice.length,
      options.activeSkills,
      options.taskPlan,
      0
    );
    const syntheticHistoryMessage: LLMMessage = {
      role: "assistant",
      content: renderCompactionMemoryMessage(provisionalSnapshot),
    };

    nextMessages = [
      nextMessages[0],
      syntheticHistoryMessage,
      ...nextMessages.slice(currentTurnStartIndex),
    ];
    currentTurnStartIndex = 2;
    estimatedTokensAfter = estimatePromptTokensForMessages(nextMessages, tools);
    historySnapshot = {
      ...provisionalSnapshot,
      estimatedTokensAfter,
    };

    events.push({
      type: "context_compacted",
      scope: "history",
      estimatedTokensBefore,
      estimatedTokensAfter,
      snapshot: historySnapshot,
    });
  }

  if (estimatedTokensAfter > thresholdTokens) {
    const turnCompactionStart = getTurnCompactionStartIndex(
      nextMessages,
      currentTurnStartIndex,
      protectedSuffixMessages
    );

    if (turnCompactionStart > currentTurnStartIndex) {
      const estimateBeforeTurn = estimatedTokensAfter;
      const turnSlice = nextMessages.slice(currentTurnStartIndex, turnCompactionStart);
      const turnSummary = await summarizeMessages(
        options.provider,
        turnSlice,
        targetTokens
      );
      const syntheticTurnMessage: LLMMessage = {
        role: "assistant",
        content: renderCompactionMemoryMessage(
          buildSnapshot(
            turnSummary,
            options.historyVisibleMessageCount,
            options.activeSkills,
            options.taskPlan,
            0
          ),
          { heading: "Compacted current-turn memory" }
        ),
      };

      nextMessages = [
        ...nextMessages.slice(0, currentTurnStartIndex),
        syntheticTurnMessage,
        ...nextMessages.slice(turnCompactionStart),
      ];
      estimatedTokensAfter = estimatePromptTokensForMessages(nextMessages, tools);

      events.push({
        type: "context_compacted",
        scope: "turn",
        estimatedTokensBefore: estimateBeforeTurn,
        estimatedTokensAfter,
      });
    }
  }

  return {
    messages: nextMessages,
    historySnapshot,
    currentTurnStartIndex,
    events,
    estimatedTokensBefore,
    estimatedTokensAfter,
  };
}
