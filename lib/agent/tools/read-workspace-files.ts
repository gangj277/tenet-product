import type { WorkspaceContext } from "../state";

/**
 * Read workspace files by key. Returns JSON map of key → content.
 */
export function executeReadWorkspaceFiles(
  args: { keys: string[] },
  ctx: WorkspaceContext
): string {
  const result: Record<string, string> = {};

  for (const key of args.keys) {
    if (key in ctx.workspaceFiles) {
      result[key] = ctx.workspaceFiles[key];
    } else {
      result[key] = `[File not found: "${key}". Available keys: ${ctx.availableKeys.join(", ")}]`;
    }
  }

  return JSON.stringify(result, null, 2);
}
