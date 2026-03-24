import assert from "node:assert/strict";
import test from "node:test";

import { runAgentLoop } from "../lib/agent/graph.ts";
import {
  compactMessagesToFitBudget,
  estimatePromptTokensForMessages,
} from "../lib/agent/compaction.ts";
import type { AgentContinuationState, WorkspaceContext } from "../lib/agent/state.ts";
import type { LLMMessage } from "../lib/llm/runtime.ts";
import type { LLMProvider } from "../lib/llm/provider.ts";

function makeWorkspace(): WorkspaceContext {
  return {
    workspaceFiles: {
      overview: "Overview",
      synthesis: "Synthesis",
    },
    availableKeys: ["overview", "synthesis"],
    fileLabels: {
      overview: "Overview",
      synthesis: "Synthesis",
    },
  };
}

function makeProvider(summaryOverrides?: Partial<Record<string, unknown>>): LLMProvider {
  return {
    kind: "openai_auth",
    async callLLM() {
      return {
        content: JSON.stringify({
          summary: "Compacted memory summary",
          keyFacts: ["Key fact one"],
          openLoops: ["Open loop one"],
          nextStepHint: "Resume with the methodology comparison.",
          ...summaryOverrides,
        }),
        model: "gpt-5.4-mini",
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        latencyMs: 1,
      };
    },
    async *callLLMStreaming() {
      yield {
        type: "done" as const,
        content: "Final answer",
        toolCalls: [],
        usage: { promptTokens: 1, completionTokens: 999999, totalTokens: 1000000 },
      };
    },
  };
}

test("estimatePromptTokensForMessages includes tool schema payload and multimodal placeholders", () => {
  const tokens = estimatePromptTokensForMessages(
    [
      { role: "system", content: "System prompt" },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ],
    [
      {
        type: "function",
        function: {
          name: "read_workspace_files",
          description: "Read files",
          parameters: {
            type: "object",
            properties: { keys: { type: "array", items: { type: "string" } } },
          },
        },
      },
    ]
  );

  assert.ok(tokens > 0);
});

test("compactMessagesToFitBudget compacts history into a snapshot and preserves continuation state", async () => {
  const taskPlan = {
    created: 1,
    activeTaskId: "task-2",
    tasks: [
      { id: "task-1", objective: "Read sources", status: "completed" as const },
      { id: "task-2", objective: "Compare methods", status: "active" as const },
    ],
  };

  const result = await compactMessagesToFitBudget({
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "A".repeat(1200) },
      { role: "assistant", content: "B".repeat(1200) },
      { role: "user", content: "What should I do next?" },
    ],
    provider: makeProvider(),
    activeSkills: ["source-scout", "methodology-critic"],
    taskPlan,
    historyVisibleMessageCount: 2,
    currentTurnStartIndex: 3,
    thresholdTokens: 100,
    targetTokens: 60,
  });

  assert.equal(result.events[0]?.type, "context_compacted");
  assert.equal(result.events[0]?.scope, "history");
  assert.equal(result.historySnapshot?.compactedMessageCount, 2);
  assert.deepEqual(result.historySnapshot?.activatedSkills, [
    "source-scout",
    "methodology-critic",
  ]);
  assert.deepEqual(result.historySnapshot?.taskPlan, taskPlan);
  assert.equal(result.messages[1]?.role, "assistant");
  assert.match(String(result.messages[1]?.content ?? ""), /Compacted memory/i);
});

test("compactMessagesToFitBudget preserves the protected tool-call suffix during turn compaction", async () => {
  const protectedAssistant: LLMMessage = {
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: "call-2",
        type: "function",
        function: { name: "search_workspace", arguments: "{\"queries\":[\"method\"]}" },
      },
    ],
  };
  const protectedTool: LLMMessage = {
    role: "tool",
    tool_call_id: "call-2",
    content: "methodology result",
  };

  const result = await compactMessagesToFitBudget({
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Initial question" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "read_workspace_files", arguments: "{\"keys\":[\"overview\"]}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call-1", content: "overview content ".repeat(200) },
      protectedAssistant,
      protectedTool,
    ],
    provider: makeProvider(),
    activeSkills: [],
    historyVisibleMessageCount: 0,
    currentTurnStartIndex: 1,
    thresholdTokens: 100,
    targetTokens: 40,
    protectedSuffixMessages: 2,
  });

  assert.deepEqual(result.messages.at(-2), protectedAssistant);
  assert.deepEqual(result.messages.at(-1), protectedTool);
  assert.ok(
    result.messages.some(
      (message, index) =>
        index > 0 &&
        message.role === "assistant" &&
        typeof message.content === "string" &&
        message.content.includes("Compacted memory")
    )
  );
});

test("runAgentLoop ignores huge cumulative usage when the live prompt is still small", async () => {
  const events: Array<{ type: string }> = [];

  for await (const event of runAgentLoop(
    "Short question",
    [],
    makeWorkspace(),
    undefined,
    undefined,
    makeProvider(),
    "medium"
  )) {
    events.push(event as { type: string });
  }

  assert.equal(events.some((event) => event.type === "context_compacted"), false);
});

test("runAgentLoop emits a history compaction event when the live prompt exceeds the threshold", async () => {
  const provider = makeProvider();
  const continuation: AgentContinuationState = {
    activeSkills: ["source-scout"],
  };
  const events: Array<Record<string, unknown>> = [];

  for await (const event of runAgentLoop(
    "Continue from the compacted context.",
    [{ role: "assistant", content: "A".repeat(1_100_000) }],
    makeWorkspace(),
    undefined,
    undefined,
    provider,
    "medium",
    continuation,
    1
  )) {
    events.push(event as Record<string, unknown>);
  }

  assert.equal(
    events.some(
      (event) =>
        event.type === "context_compacted" && event.scope === "history"
    ),
    true
  );
});

test("runAgentLoop preserves OpenAI prompt and completion usage in the done event", async () => {
  let doneEvent:
    | {
        type: "done";
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
      }
    | undefined;

  for await (const event of runAgentLoop(
    "Short question",
    [],
    makeWorkspace(),
    undefined,
    undefined,
    makeProvider(),
    "medium"
  )) {
    if (event.type === "done") {
      doneEvent = event;
    }
  }

  assert.deepEqual(doneEvent?.usage, {
    promptTokens: 1,
    completionTokens: 999999,
    totalTokens: 1000000,
  });
});
