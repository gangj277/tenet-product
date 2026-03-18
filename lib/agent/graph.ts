import type { LLMMessage, ContentPart } from "@/lib/llm/openrouter";
import { MODEL_AGENT } from "@/lib/llm/models";
import { callLLMStreaming } from "@/lib/llm/openrouter-streaming";
import { TOOL_SCHEMAS, executeTool } from "./tools";
import { buildConstitution } from "./prompts/constitution";
import type { AgentState, SSEEvent, WorkspaceContext } from "./state";
import { sleep } from "@/lib/utils/async";

const MAX_ITERATIONS = 8;

/** Human-readable labels for tool-call activities. */
const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  read_workspace_files: "Reading workspace files",
  search_workspace: "Searching workspace",
  update_existing_file: "Preparing edits",
  write_new_file: "Drafting new content",
  create_paper: "Drafting paper",
  search_external_sources: "Searching external sources",
  load_skill: "Loading skill",
};

/**
 * Run the workspace agent ReAct loop.
 * Yields SSE events for real-time streaming to the client.
 */
export async function* runAgentLoop(
  userMessage: string,
  conversationHistory: LLMMessage[],
  workspaceCtx: WorkspaceContext,
  imageAttachments?: ContentPart[],
): AsyncGenerator<SSEEvent> {
  // 1. Build system prompt (skills are listed but not loaded — agent loads on demand)
  const systemPrompt = buildConstitution(workspaceCtx);

  // 2. Build initial messages — use content parts array when images are attached
  const userContent: string | ContentPart[] = imageAttachments?.length
    ? [{ type: "text" as const, text: userMessage }, ...imageAttachments]
    : userMessage;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userContent },
  ];

  const state: AgentState = {
    messages,
    proposedUpdates: [],
    searchResults: [],
    activatedSkills: [],
    totalTokens: 0,
    iterations: 0,
  };

  // 3. ReAct loop
  yield { type: "activity", activity: "Analyzing your question" };

  while (state.iterations < MAX_ITERATIONS) {
    state.iterations++;

    if (state.iterations > 1) {
      yield { type: "activity", activity: "Composing response" };
    }

    let fullContent = "";
    let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

    // Stream LLM response
    try {
      for await (const chunk of callLLMStreaming({
        messages: state.messages,
        tools: TOOL_SCHEMAS,
        model: MODEL_AGENT,
        temperature: 0.3,
        maxTokens: 4096,
      })) {
        switch (chunk.type) {
          case "text_delta":
            yield { type: "text_delta", content: chunk.content };
            break;
          case "done":
            fullContent = chunk.content;
            toolCalls = chunk.toolCalls;
            if (chunk.usage) {
              state.totalTokens += chunk.usage.totalTokens;
            }
            break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM call failed";
      yield { type: "error", message };
      break;
    }

    // No tool calls → agent is done
    if (toolCalls.length === 0) {
      if (fullContent) {
        state.messages.push({ role: "assistant", content: fullContent });
      }
      break;
    }

    // Append assistant message with tool_calls for proper OpenAI conversation format
    // Per spec: content should be null when only tool_calls are returned
    state.messages.push({
      role: "assistant",
      content: fullContent || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    // Execute each tool call
    for (const tc of toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        yield { type: "tool_result", name: tc.name, result: "Error: Invalid tool arguments (malformed JSON)" };
        state.messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `Error: Invalid tool arguments (malformed JSON). Please try again with valid JSON arguments.`,
        });
        continue;
      }

      const activityLabel = TOOL_ACTIVITY_LABELS[tc.name] ?? `Running ${tc.name}`;
      yield { type: "activity", activity: activityLabel };
      yield { type: "tool_call", name: tc.name, args };

      // Progress callback pushes messages into a queue; we poll it on a
      // short interval and yield activity events while the tool runs.
      const progressQueue: string[] = [];
      const onProgress = (msg: string) => { progressQueue.push(msg); };

      let toolResult: Awaited<ReturnType<typeof executeTool>> | undefined;
      let toolError: unknown;

      const toolPromise = executeTool(tc.name, args, workspaceCtx, onProgress)
        .then((r) => { toolResult = r; })
        .catch((e) => { toolError = e; });

      // Poll every 500ms until the tool finishes, draining progress messages
      while (!toolResult && !toolError) {
        await Promise.race([toolPromise, sleep(500)]);
        // Drain all queued progress messages
        while (progressQueue.length > 0) {
          yield { type: "activity", activity: progressQueue.shift()! };
        }
      }

      if (toolError) {
        const errMsg = toolError instanceof Error ? toolError.message : "Tool execution failed";
        yield { type: "error", message: errMsg };
        state.messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `Error: ${errMsg}`,
        });
        continue;
      }

      const tr = toolResult!;
      yield { type: "tool_result", name: tc.name, result: tr.result };

      // Emit proposed updates
      if (tr.proposedUpdate) {
        state.proposedUpdates.push(tr.proposedUpdate);
        yield { type: "proposed_update", update: tr.proposedUpdate };
      }

      // Emit search results
      if (tr.searchResults) {
        state.searchResults.push(...tr.searchResults);
        yield { type: "search_results", results: tr.searchResults };
      }

      // Emit newly added workspace sources + update context for subsequent iterations
      if (tr.addedSources?.length) {
        yield { type: "sources_added", sources: tr.addedSources };
        for (const s of tr.addedSources) {
          workspaceCtx.workspaceFiles[s.key] = s.content;
          workspaceCtx.availableKeys.push(s.key);
          if (workspaceCtx.fileLabels) {
            workspaceCtx.fileLabels[s.key] = s.label;
          }
          if (workspaceCtx.fileMeta) {
            workspaceCtx.fileMeta[s.key] = {
              group: "source",
              origin: "discovered",
              folder: s.folder,
            };
          }
        }
      }

      // Track loaded skills
      if (tr.loadedSkillId) {
        state.activatedSkills.push(tr.loadedSkillId);
        yield { type: "skill_activated", skills: [tr.loadedSkillId] };
      }

      // Append tool result as role:"tool" with matching tool_call_id
      state.messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: tr.result,
      });
    }
  }

  // 4. Done
  yield { type: "done", usage: { totalTokens: state.totalTokens } };
}
