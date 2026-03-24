import type { ChatMessage, ChatUsageState } from "@/app/dashboard/[runId]/_lib/workspace-types";
import { buildSystemPrompt } from "./prompts/constitution";
import { SKILL_MAP } from "./prompts/skills";
import {
  COMPACTION_THRESHOLD_TOKENS,
  estimatePromptTokensForMessages,
  renderCompactionMemoryMessage,
} from "./compaction";
import type {
  AgentContinuationState,
  TaskPlan,
  TaskState,
  TokenUsage,
  WorkspaceContext,
} from "./state";
import { SKILL_REFERENCE_TOOL, TOOL_SCHEMAS } from "./tools/tool-schemas";

function buildTaskPlanFromStates(
  tasks: TaskState[] | undefined,
  createdAt: number
): TaskPlan | undefined {
  if (!tasks?.length) return undefined;
  return {
    tasks,
    activeTaskId: tasks.find((task) => task.status === "active")?.id,
    created: createdAt,
  };
}

export function deriveChatContinuationState(
  messages: ChatMessage[]
): AgentContinuationState {
  const latestSnapshot = [...messages]
    .reverse()
    .find((message) => message.compactionSnapshot)?.compactionSnapshot;
  const latestSkills =
    [...messages].reverse().find((message) => message.activatedSkills?.length)
      ?.activatedSkills ??
    latestSnapshot?.activatedSkills ??
    [];

  const latestTaskPlanStates = [...messages]
    .reverse()
    .find((message) => message.taskPlan?.length);
  const latestTaskPlan =
    buildTaskPlanFromStates(
      latestTaskPlanStates?.taskPlan,
      latestTaskPlanStates?.timestamp ?? Date.now()
    ) ??
    latestSnapshot?.taskPlan;

  return {
    activeSkills: latestSkills,
    ...(latestTaskPlan ? { taskPlan: latestTaskPlan } : {}),
    ...(latestSnapshot ? { compactionSnapshot: latestSnapshot } : {}),
  };
}

function getPendingProposedUpdates(messages: ChatMessage[]) {
  return messages.flatMap((message) =>
    (message.proposedUpdates ?? [])
      .filter((update) => update.status === "pending")
      .map((update) => ({ key: update.key, summary: update.summary }))
  );
}

function getPendingQuestions(messages: ChatMessage[]) {
  return messages
    .flatMap((message) =>
      message.askUserQuestion ? [message.askUserQuestion] : []
    )
    .filter((question) => question.status === "pending")
    .map((question) => question.question);
}

export function buildConversationHistoryFromMessages(
  messages: ChatMessage[],
  continuationState: AgentContinuationState
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!continuationState.compactionSnapshot) {
    return messages
      .filter((message) => message.text.trim())
      .map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.text,
      }));
  }

  const syntheticMemory = renderCompactionMemoryMessage(
    continuationState.compactionSnapshot,
    {
      activeSkills: continuationState.activeSkills,
      taskPlan: continuationState.taskPlan,
      pendingProposedUpdates: getPendingProposedUpdates(messages),
      pendingQuestions: getPendingQuestions(messages),
    }
  );
  const rawTail = messages
    .slice(continuationState.compactionSnapshot.compactedMessageCount)
    .filter((message) => !message.compactionSnapshot && message.text.trim())
    .map((message) => ({
      role: message.role === "user" ? "user" as const : "assistant" as const,
      content: message.text,
    }));

  return [{ role: "assistant", content: syntheticMemory }, ...rawTail];
}

export function estimateLiveContextUsage({
  messages,
  continuation,
  workspaceContext,
  thresholdTokens = COMPACTION_THRESHOLD_TOKENS,
}: {
  messages: ChatMessage[];
  continuation: AgentContinuationState;
  workspaceContext: WorkspaceContext;
  thresholdTokens?: number;
}): ChatUsageState {
  const activeSkills = continuation.activeSkills
    .map((id) => SKILL_MAP.get(id))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const history = buildConversationHistoryFromMessages(messages, continuation);
  const systemPrompt = buildSystemPrompt(workspaceContext, activeSkills);
  const tools =
    continuation.activeSkills.length > 0
      ? [...TOOL_SCHEMAS, SKILL_REFERENCE_TOOL]
      : TOOL_SCHEMAS;
  const estimatedLiveContextTokens = estimatePromptTokensForMessages(
    [
      { role: "system", content: systemPrompt },
      ...history.map((message) => ({
        role: message.role === "user" ? "user" as const : "assistant" as const,
        content: message.content,
      })),
      { role: "user", content: "[Next user message placeholder]" },
    ],
    tools
  );

  return {
    estimatedLiveContextTokens,
    compactionThresholdTokens: thresholdTokens,
    compactionStatus:
      estimatedLiveContextTokens >= thresholdTokens * 0.8 ? "near_limit" : "idle",
    ...(continuation.compactionSnapshot?.compactedAt
      ? {
          lastCompactedAt: Date.parse(
            continuation.compactionSnapshot.compactedAt
          ),
        }
      : {}),
  };
}

export function resolveDisplayedChatUsage(
  baseUsage: ChatUsageState,
  providerUsage?: TokenUsage | null
): ChatUsageState {
  if (!providerUsage || providerUsage.promptTokens <= 0) {
    return baseUsage;
  }

  return {
    ...baseUsage,
    lastInferenceUsage: providerUsage,
  };
}

export function isCompactCommand(
  text: string,
  attachments?: ArrayLike<unknown> | null
): boolean {
  return text.trim() === "/compact" && !(attachments && attachments.length > 0);
}
