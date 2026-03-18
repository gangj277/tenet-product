import type { ProposedUpdate, WorkspaceContext } from "../state";

interface LineEdit {
  start_line: number;
  end_line: number;
  content: string;
}

type UpdateArgs =
  | { key: string; summary: string; mode?: "rewrite"; content: string }
  | { key: string; summary: string; mode: "line_edit"; edits: LineEdit[] };

/**
 * Propose an edit to an existing workspace file.
 * Does NOT apply the edit — emits a proposed_update event for user review.
 *
 * Supports two modes:
 * - "rewrite" (default): replaces entire file content
 * - "line_edit": applies targeted line-range edits and merges into full content
 */
export function executeUpdateExistingFile(
  args: UpdateArgs,
  ctx: WorkspaceContext
): { result: string; update: ProposedUpdate } | { result: string; update: null } {
  if (!(args.key in ctx.workspaceFiles)) {
    return {
      result: `Error: File "${args.key}" does not exist in the workspace. Available keys: ${ctx.availableKeys.join(", ")}`,
      update: null,
    };
  }

  const mode = args.mode ?? "rewrite";

  if (mode === "rewrite") {
    const content = (args as { content: string }).content;
    if (content == null) {
      return {
        result: `Error: "content" is required for rewrite mode.`,
        update: null,
      };
    }

    const update: ProposedUpdate = {
      id: crypto.randomUUID(),
      type: "edit",
      key: args.key,
      content,
      summary: args.summary,
    };

    return {
      result: `Proposed edit to "${args.key}": ${args.summary}. The user will review and accept or reject this change.`,
      update,
    };
  }

  // line_edit mode
  const edits = (args as { edits: LineEdit[] }).edits;
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    return {
      result: `Error: "edits" array is required and must be non-empty for line_edit mode.`,
      update: null,
    };
  }

  const currentContent = ctx.workspaceFiles[args.key];
  const lines = currentContent.split("\n");
  const totalLines = lines.length;

  // Validate line numbers
  for (const edit of edits) {
    if (
      !Number.isInteger(edit.start_line) ||
      !Number.isInteger(edit.end_line) ||
      edit.start_line < 1 ||
      edit.end_line < edit.start_line ||
      edit.end_line > totalLines
    ) {
      return {
        result: `Error: Invalid line range [${edit.start_line}, ${edit.end_line}]. File "${args.key}" has ${totalLines} lines. Ranges must be 1-indexed, with start_line <= end_line <= ${totalLines}.`,
        update: null,
      };
    }
  }

  // Sort by start_line to check for overlaps
  const sorted = [...edits].sort((a, b) => a.start_line - b.start_line);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_line <= sorted[i - 1].end_line) {
      return {
        result: `Error: Overlapping edit ranges detected: [${sorted[i - 1].start_line}, ${sorted[i - 1].end_line}] and [${sorted[i].start_line}, ${sorted[i].end_line}].`,
        update: null,
      };
    }
  }

  // Apply edits bottom-up (descending start_line) to avoid line-shift issues
  const result = [...lines];
  const descending = [...sorted].reverse();
  const editDescriptions: string[] = [];

  for (const edit of descending) {
    const startIdx = edit.start_line - 1; // convert to 0-indexed
    const deleteCount = edit.end_line - edit.start_line + 1;
    const replacement =
      edit.content === "" ? [] : edit.content.split("\n");

    result.splice(startIdx, deleteCount, ...replacement);
    editDescriptions.unshift(
      `L${edit.start_line}-${edit.end_line} → ${replacement.length} line(s)`
    );
  }

  const mergedContent = result.join("\n");
  const autoSummary = `${args.summary} [edits: ${editDescriptions.join("; ")}]`;

  const update: ProposedUpdate = {
    id: crypto.randomUUID(),
    type: "edit",
    key: args.key,
    content: mergedContent,
    summary: autoSummary,
  };

  return {
    result: `Proposed line edits to "${args.key}": ${autoSummary}. The user will review and accept or reject this change.`,
    update,
  };
}
