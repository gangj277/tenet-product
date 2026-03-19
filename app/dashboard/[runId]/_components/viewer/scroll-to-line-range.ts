import type { LineRange } from "../../../_lib/citation-utils";

export function stripMarkdownForTextMatch(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function getPlainTextNeedleForLineRange(
  content: string,
  pendingLineRange: LineRange
): string | null {
  const lines = content.split("\n");
  const start = Math.max(0, pendingLineRange.start - 1);
  const end = Math.min(lines.length, pendingLineRange.end);
  const targetLines = lines.slice(start, end);
  const needle = targetLines.find((line) => line.trim().length > 0)?.trim();

  if (!needle) return null;

  return stripMarkdownForTextMatch(needle);
}
