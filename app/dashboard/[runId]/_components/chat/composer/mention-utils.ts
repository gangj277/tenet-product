import type { FileEntry } from "../../../_lib/workspace-types";

export interface FileMentionEntry {
  type: "file";
  key: string;
  label: string;
  shortLabel: string;
  icon: FileEntry["icon"];
  group: FileEntry["group"];
  mentionToken: string;
}

export interface FolderMentionEntry {
  type: "folder";
  path: string;
  label: string;
  shortLabel: string;
  mentionToken: string;
}

export type MentionEntry = FileMentionEntry | FolderMentionEntry;

function escapeMentionPath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formatFolderMentionToken(path: string): string {
  return `@folder:"${escapeMentionPath(path)}"`;
}

export function buildMentionEntries(
  files: FileEntry[],
  folderPaths: string[]
): MentionEntry[] {
  const fileEntries: FileMentionEntry[] = files.map((file) => ({
    type: "file",
    key: file.key,
    label: file.label,
    shortLabel: file.shortLabel,
    icon: file.icon,
    group: file.group,
    mentionToken: `@${file.key}`,
  }));

  const folderEntries: FolderMentionEntry[] = Array.from(new Set(folderPaths))
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({
      type: "folder",
      path,
      label: path,
      shortLabel: path.split("/").filter(Boolean).pop() ?? path,
      mentionToken: formatFolderMentionToken(path),
    }));

  return [...fileEntries, ...folderEntries];
}
