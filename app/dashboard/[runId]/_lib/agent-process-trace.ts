export type AgentProcessStepStatus = "active" | "completed" | "error";

export interface AgentProcessStep {
  id: string;
  kind: "tool" | "phase";
  label: string;
  detail?: string;
  statusLabel?: string;
  status: AgentProcessStepStatus;
  toolName?: string;
}

const GENERIC_TOOL_ACTIVITY_LABELS = new Set([
  "Reading workspace files",
  "Searching workspace",
  "Preparing edits",
  "Drafting new content",
  "Drafting paper",
  "Searching external sources",
  "Loading skill",
  "Reading reference material",
  "Waiting for your input",
  "Planning task decomposition",
  "Recording task findings",
]);

const SKILL_LABELS: Record<string, string> = {
  "devils-advocate": "Devil's Advocate",
  "source-scout": "Source Scout",
  "paper-explainer": "Paper Explainer",
  "evidence-adjudicator": "Evidence Adjudicator",
  "synthesis-updater": "Synthesis Updater",
  "draft-paper": "Paper Drafter",
  "methodology-critic": "Methodology Critic",
  "experiment-designer": "Experiment Designer",
};

function nextStepId(trace: AgentProcessStep[]): string {
  return `step-${trace.length + 1}`;
}

function formatQuotedList(values: string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

function formatReadableList(values: string[]): string {
  return values.join(", ");
}

function normalizeFileLabel(
  key: string,
  fileLabels: Record<string, string>
): string {
  return fileLabels[key] ?? key;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizePhaseActivity(activity: string): {
  label: string;
  detail?: string;
} {
  if (activity.startsWith("Working on:")) {
    return {
      label: "Working on task",
      detail: activity.slice("Working on:".length).trim() || undefined,
    };
  }

  if (activity === "All tasks complete — composing final response") {
    return { label: "Composing response" };
  }

  return { label: activity };
}

function updateActiveStep(
  trace: AgentProcessStep[],
  updater: (step: AgentProcessStep) => AgentProcessStep
): AgentProcessStep[] {
  for (let index = trace.length - 1; index >= 0; index -= 1) {
    if (trace[index].status !== "active") continue;
    return trace.map((step, currentIndex) =>
      currentIndex === index ? updater(step) : step
    );
  }
  return trace;
}

export function completeActiveProcessTrace(
  trace: AgentProcessStep[]
): AgentProcessStep[] {
  return updateActiveStep(trace, (step) => ({ ...step, status: "completed" }));
}

export function failActiveProcessTrace(
  trace: AgentProcessStep[],
  statusLabel?: string
): AgentProcessStep[] {
  return updateActiveStep(trace, (step) => ({
    ...step,
    status: "error",
    ...(statusLabel ? { statusLabel } : {}),
  }));
}

export function recordToolCallTrace(
  trace: AgentProcessStep[],
  toolName: string,
  args: Record<string, unknown>,
  fileLabels: Record<string, string> = {}
): AgentProcessStep[] {
  const next = completeActiveProcessTrace(trace);
  const summary = describeToolCall(toolName, args, fileLabels);

  return [
    ...next,
    {
      id: nextStepId(next),
      kind: "tool",
      label: summary.label,
      ...(summary.detail ? { detail: summary.detail } : {}),
      status: "active",
      toolName,
    },
  ];
}

export function recordProcessActivity(
  trace: AgentProcessStep[],
  activity: string
): AgentProcessStep[] {
  const normalized = activity.trim();
  if (!normalized) return trace;
  if (GENERIC_TOOL_ACTIVITY_LABELS.has(normalized)) return trace;

  const isPhaseActivity =
    normalized === "Analyzing your question" ||
    normalized === "Composing response" ||
    normalized === "All tasks complete — composing final response" ||
    normalized.startsWith("Working on:");

  if (isPhaseActivity) {
    const next = completeActiveProcessTrace(trace);
    const phase = normalizePhaseActivity(normalized);
    const last = next[next.length - 1];
    if (
      last &&
      last.kind === "phase" &&
      last.label === phase.label &&
      last.detail === phase.detail
    ) {
      return next.map((step, index) =>
        index === next.length - 1 ? { ...step, status: "active" } : step
      );
    }

    return [
      ...next,
      {
        id: nextStepId(next),
        kind: "phase",
        label: phase.label,
        ...(phase.detail ? { detail: phase.detail } : {}),
        status: "active",
      },
    ];
  }

  return updateActiveStep(trace, (step) => {
    if (step.statusLabel === normalized) return step;
    return { ...step, statusLabel: normalized };
  });
}

export function describeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  fileLabels: Record<string, string> = {}
): { label: string; detail?: string } {
  switch (toolName) {
    case "read_workspace_files": {
      const keys = getStringArray(args.keys);
      return {
        label: "Reading files",
        detail:
          keys.length > 0
            ? formatReadableList(keys.map((key) => normalizeFileLabel(key, fileLabels)))
            : undefined,
      };
    }
    case "search_workspace": {
      const queries = getStringArray(args.queries);
      const fileKeys = getStringArray(args.file_keys);
      const queryText = queries.length > 0 ? formatQuotedList(queries) : undefined;
      const scope =
        fileKeys.length > 0
          ? formatReadableList(
              fileKeys.map((key) => normalizeFileLabel(key, fileLabels))
            )
          : undefined;

      return {
        label: "Searching workspace",
        detail:
          queryText && scope
            ? `${queryText} in ${scope}`
            : queryText ?? scope,
      };
    }
    case "update_existing_file": {
      const key =
        typeof args.key === "string" ? normalizeFileLabel(args.key, fileLabels) : undefined;
      return {
        label: "Preparing edit",
        detail: key,
      };
    }
    case "write_new_file": {
      const label = typeof args.label === "string" ? args.label : undefined;
      return {
        label: "Drafting new file",
        detail: label,
      };
    }
    case "create_paper": {
      return {
        label: "Drafting paper",
        detail: typeof args.title === "string" ? args.title : undefined,
      };
    }
    case "create_experiment": {
      return {
        label: "Designing experiment",
        detail: typeof args.title === "string" ? args.title : undefined,
      };
    }
    case "edit_experiment": {
      const key =
        typeof args.key === "string" ? normalizeFileLabel(args.key, fileLabels) : undefined;
      return {
        label: "Editing experiment",
        detail: key,
      };
    }
    case "search_external_sources": {
      const searches = Array.isArray(args.searches)
        ? args.searches
            .map((search) => getRecord(search)?.query)
            .filter((query): query is string => typeof query === "string" && query.trim().length > 0)
        : [];
      return {
        label: "Searching external sources",
        detail: searches.length > 0 ? formatQuotedList(searches) : undefined,
      };
    }
    case "load_skill": {
      const skillId = typeof args.skill_id === "string" ? args.skill_id : undefined;
      return {
        label: "Loading skill",
        detail: skillId ? SKILL_LABELS[skillId] ?? skillId : undefined,
      };
    }
    case "read_skill_reference": {
      return {
        label: "Reading reference",
        detail: typeof args.path === "string" ? args.path : undefined,
      };
    }
    case "ask_user": {
      return {
        label: "Waiting for input",
        detail: typeof args.question === "string" ? args.question : undefined,
      };
    }
    case "plan_tasks": {
      const tasks = Array.isArray(args.tasks) ? args.tasks.length : 0;
      return {
        label: "Planning task sequence",
        detail: tasks > 0 ? `${tasks} tasks` : undefined,
      };
    }
    case "complete_task": {
      return {
        label: "Completing task",
        detail: typeof args.task_id === "string" ? args.task_id : undefined,
      };
    }
    default:
      return {
        label: toolName.replace(/_/g, " "),
      };
  }
}
