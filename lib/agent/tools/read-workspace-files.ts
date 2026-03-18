import type { WorkspaceContext } from "../state";

/**
 * Read workspace files by key. Returns JSON map of key → content.
 * When line_numbers is true, prefixes each line with its 1-indexed number.
 */
export function executeReadWorkspaceFiles(
  args: { keys: string[]; line_numbers?: boolean },
  ctx: WorkspaceContext
): string {
  const result: Record<string, string> = {};

  for (const key of args.keys) {
    if (key in ctx.workspaceFiles) {
      let content = ctx.workspaceFiles[key];
      if (args.line_numbers) {
        content = content
          .split("\n")
          .map((line, i) => `${i + 1}| ${line}`)
          .join("\n");
      }
      result[key] = content;
    } else {
      result[key] = `[File not found: "${key}". Available keys: ${ctx.availableKeys.join(", ")}]`;
    }
  }

  return JSON.stringify(result, null, 2);
}
