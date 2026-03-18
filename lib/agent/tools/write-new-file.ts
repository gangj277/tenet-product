import type { ProposedUpdate, WorkspaceContext } from "../state";

/**
 * Propose a new file for the workspace.
 * Does NOT create the file — emits a proposed_update event for user review.
 */
export function executeWriteNewFile(
  args: { key: string; label: string; content: string },
  ctx: WorkspaceContext
): { result: string; update: ProposedUpdate } | { result: string; update: null } {
  if (args.key in ctx.workspaceFiles) {
    return {
      result: `Error: File "${args.key}" already exists. Use update_existing_file to modify it.`,
      update: null,
    };
  }

  const update: ProposedUpdate = {
    id: crypto.randomUUID(),
    type: "new",
    key: args.key,
    label: args.label,
    content: args.content,
    summary: `New file: ${args.label}`,
  };

  return {
    result: `Proposed new file "${args.label}" (key: "${args.key}"). The user will review and accept or reject.`,
    update,
  };
}
