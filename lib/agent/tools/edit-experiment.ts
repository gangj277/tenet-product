import type { ProposedUpdate, WorkspaceContext } from "../state";
import type { ExperimentDesign } from "./experiment-design-schema";
import { isExperimentDesign } from "./experiment-design-schema";

/**
 * Edit an existing structured experiment design in the workspace.
 * Accepts a partial ExperimentDesign and deep-merges it with the existing experiment.
 * Emits a proposed_update for user review (type: "edit").
 */
export function executeEditExperiment(
  args: { key: string; updates: Partial<ExperimentDesign>; summary: string },
  ctx: WorkspaceContext
): { result: string; update: ProposedUpdate | null } {
  // Resolve key — accept both "experiment:uuid" and bare "uuid"
  const key = args.key.startsWith("experiment:") ? args.key : `experiment:${args.key}`;

  // Look up existing experiment from workspace files
  const existing = ctx.workspaceFiles[key];
  if (!existing) {
    const available = ctx.availableKeys.filter((k) => k.startsWith("experiment:"));
    return {
      result: `Experiment "${key}" not found in workspace. Available experiments: ${available.length ? available.join(", ") : "(none)"}`,
      update: null,
    };
  }

  // Parse existing content
  let current: ExperimentDesign;
  try {
    const parsed = JSON.parse(existing);
    if (!isExperimentDesign(parsed)) {
      return {
        result: `Experiment "${key}" exists but is not a valid structured experiment design. Use update_existing_file instead.`,
        update: null,
      };
    }
    current = parsed;
  } catch {
    return {
      result: `Experiment "${key}" exists but contains invalid JSON. Use update_existing_file instead.`,
      update: null,
    };
  }

  // Deep-merge updates into current design
  const merged = deepMergeDesign(current, args.updates);

  const title = merged.title ?? current.title;

  const update: ProposedUpdate = {
    id: crypto.randomUUID(),
    type: "edit",
    key,
    label: title,
    content: JSON.stringify(merged),
    summary: args.summary,
  };

  return {
    result: `Proposed edits to experiment "${title}" (key: "${key}"): ${args.summary}. The user will review and accept or reject.`,
    update,
  };
}

/**
 * Deep-merge partial ExperimentDesign updates into an existing design.
 * Arrays are replaced wholesale (not appended) since the agent provides
 * the complete updated array when modifying hypotheses, procedure, etc.
 */
function deepMergeDesign(
  current: ExperimentDesign,
  updates: Partial<ExperimentDesign>
): ExperimentDesign {
  const merged = { ...current };

  // Simple scalar fields — overwrite if provided
  if (updates.version !== undefined) merged.version = updates.version;
  if (updates.title !== undefined) merged.title = updates.title;
  if (updates.researchQuestion !== undefined) merged.researchQuestion = updates.researchQuestion;
  if (updates.motivation !== undefined) merged.motivation = updates.motivation;
  if (updates.ethics !== undefined) merged.ethics = updates.ethics;

  // Arrays — replace wholesale
  if (updates.hypotheses !== undefined) merged.hypotheses = updates.hypotheses;
  if (updates.procedure !== undefined) merged.procedure = updates.procedure;
  if (updates.limitations !== undefined) merged.limitations = updates.limitations;

  // Nested objects — shallow merge one level deep
  if (updates.variables !== undefined) {
    merged.variables = {
      independent: updates.variables.independent ?? current.variables.independent,
      dependent: updates.variables.dependent ?? current.variables.dependent,
      controls: updates.variables.controls ?? current.variables.controls,
    };
  }
  if (updates.design !== undefined) {
    merged.design = { ...current.design, ...updates.design };
  }
  if (updates.sample !== undefined) {
    merged.sample = { ...current.sample, ...updates.sample };
  }
  if (updates.analysis !== undefined) {
    merged.analysis = { ...current.analysis, ...updates.analysis };
  }

  return merged;
}
