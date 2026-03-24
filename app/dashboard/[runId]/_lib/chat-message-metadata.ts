import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { TaskState, TokenUsage } from "@/lib/agent/state";
import type {
  ChatAskUserQuestion,
  ChatMessage,
  ProposedUpdate,
} from "./workspace-types";
import type { AgentProcessStep } from "./agent-process-trace";

export function buildPersistedMessageMetadata(message: {
  proposedUpdates?: ProposedUpdate[];
  searchResults?: DiscoveredSource[];
  askUserQuestion?: ChatAskUserQuestion;
  taskPlan?: TaskState[];
  processTrace?: AgentProcessStep[];
  activatedSkills?: string[];
  compactionSnapshot?: import("@/lib/agent/state").CompactionSnapshot;
  providerUsage?: TokenUsage;
}) {
  const metadata: Record<string, unknown> = {};

  if (message.proposedUpdates?.length) {
    metadata.proposedUpdates = message.proposedUpdates;
  }
  if (message.searchResults?.length) {
    metadata.searchResults = message.searchResults;
  }
  if (message.askUserQuestion) {
    metadata.askUserQuestion = message.askUserQuestion;
  }
  if (message.taskPlan?.length) {
    metadata.taskPlan = message.taskPlan;
  }
  if (message.processTrace?.length) {
    metadata.processTrace = message.processTrace;
  }
  if (message.activatedSkills?.length) {
    metadata.activatedSkills = message.activatedSkills;
  }
  if (message.compactionSnapshot) {
    metadata.compactionSnapshot = message.compactionSnapshot;
  }
  if (message.providerUsage) {
    metadata.providerUsage = message.providerUsage;
  }

  return metadata;
}

export function hydrateStoredChatMessage(message: {
  id: string;
  role: "user" | "agent";
  text: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    timestamp: new Date(message.createdAt).getTime(),
    proposedUpdates: message.metadata?.proposedUpdates as
      | ProposedUpdate[]
      | undefined,
    searchResults: message.metadata?.searchResults as
      | DiscoveredSource[]
      | undefined,
    activityLabel: message.metadata?.activityLabel as string | undefined,
    askUserQuestion: message.metadata?.askUserQuestion as
      | ChatAskUserQuestion
      | undefined,
    taskPlan: message.metadata?.taskPlan as TaskState[] | undefined,
    processTrace: message.metadata?.processTrace as AgentProcessStep[] | undefined,
    activatedSkills: message.metadata?.activatedSkills as string[] | undefined,
    compactionSnapshot: message.metadata?.compactionSnapshot as
      | import("@/lib/agent/state").CompactionSnapshot
      | undefined,
    providerUsage: message.metadata?.providerUsage as TokenUsage | undefined,
  };
}
