import type { ProposedUpdate, WorkspaceContext } from "../state";

/**
 * Create a new experiment design in the workspace.
 * Generates an `experiment:<uuid>` key and emits a proposed_update for user review.
 */
export function executeCreateExperiment(
  args: { title: string; content: string },
  ctx: WorkspaceContext
): { result: string; update: ProposedUpdate } {
  const experimentId = crypto.randomUUID();
  const key = `experiment:${experimentId}`;

  const update: ProposedUpdate = {
    id: crypto.randomUUID(),
    type: "new",
    key,
    label: args.title,
    content: args.content,
    summary: `New experiment design: ${args.title}`,
  };

  return {
    result: `Proposed new experiment design "${args.title}" (key: "${key}"). The user will review and accept or reject.`,
    update,
  };
}
