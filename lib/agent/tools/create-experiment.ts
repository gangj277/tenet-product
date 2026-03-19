import type { ProposedUpdate, WorkspaceContext } from "../state";
import type { ExperimentDesign } from "./experiment-design-schema";

/**
 * Create a new structured experiment design in the workspace.
 * Accepts a typed ExperimentDesign object, stores it as JSON.
 * Generates an `experiment:<uuid>` key and emits a proposed_update for user review.
 */
export function executeCreateExperiment(
  args: { title: string; design: ExperimentDesign },
  _ctx: WorkspaceContext
): { result: string; update: ProposedUpdate } {
  const experimentId = crypto.randomUUID();
  const key = `experiment:${experimentId}`;

  const title = args.design.title ?? args.title;

  const update: ProposedUpdate = {
    id: crypto.randomUUID(),
    type: "new",
    key,
    label: title,
    content: JSON.stringify(args.design),
    summary: `New experiment design: ${title}`,
  };

  return {
    result: `Proposed new experiment design "${title}" (key: "${key}"). The user will review and accept or reject.`,
    update,
  };
}
