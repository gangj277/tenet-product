import type { Artifacts } from "@/lib/engine/state";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import type { ExperimentMeta, NoteMeta, SourceMeta } from "@/lib/db/research-projects";

export interface FileEntry {
  key: string;
  label: string;
  shortLabel: string;
  icon:
    | "overview"
    | "synthesis"
    | "claims"
    | "gaps"
    | "next-steps"
    | "source-uploaded"
    | "source-discovered"
    | "paper"
    | "note"
    | "experiment";
  group: "core" | "source" | "paper" | "note" | "experiment";
  origin?: "uploaded" | "discovered";
  folder?: string;
  fileType?: "markdown" | "latex";
  sourceUrl?: string;
  paperQuality?: PaperQualityMeta;
  isLoading?: boolean;
}

export interface ProposedUpdate {
  id: string;
  type: "edit" | "new";
  key: string;
  label?: string;
  content: string;
  summary: string;
  status: "pending" | "accepted" | "rejected";
}

export interface ChatAttachmentInfo {
  name: string;
  type: "image" | "pdf";
  previewUrl?: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  activityLabel?: string;
  proposedUpdates?: ProposedUpdate[];
  searchResults?: DiscoveredSource[];
  attachments?: ChatAttachmentInfo[];
}

export interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export const CORE_FILES: FileEntry[] = [
  { key: "overview", label: "Overview", shortLabel: "Overview", icon: "overview", group: "core" },
  { key: "synthesis", label: "Synthesis", shortLabel: "Synthesis", icon: "synthesis", group: "core" },
  { key: "claims", label: "Claims", shortLabel: "Claims", icon: "claims", group: "core" },
  { key: "gaps", label: "Gaps", shortLabel: "Gaps", icon: "gaps", group: "core" },
  { key: "nextSteps", label: "Next Steps", shortLabel: "Next Steps", icon: "next-steps", group: "core" },
];

/**
 * Strips file extensions, replaces underscores/hyphens with spaces,
 * and truncates to ~32 chars at a word boundary.
 */
export function truncateSourceName(raw: string): string {
  // Strip common extensions
  let cleaned = raw.replace(/\.(pdf|html|htm|txt|md|docx?)$/i, "");
  // Replace underscores and hyphens with spaces
  cleaned = cleaned.replace(/[_-]+/g, " ").trim();
  // Truncate at ~32 chars at word boundary
  if (cleaned.length <= 32) return cleaned;
  const truncated = cleaned.slice(0, 32);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 16 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

export function buildFileList(
  artifacts: Artifacts,
  sourcesMeta?: Record<string, SourceMeta>,
  notesMeta?: Record<string, NoteMeta>,
  experimentsMeta?: Record<string, ExperimentMeta>
): FileEntry[] {
  const files: FileEntry[] = [];

  for (const f of CORE_FILES) {
    const content = artifacts[f.key as keyof Artifacts];
    if (content && typeof content === "string" && content.trim()) {
      files.push(f);
    }
  }

  // Notes (shown inside Artifacts section)
  const noteKeys = Object.keys(artifacts.notes || {});
  for (const key of noteKeys) {
    const meta = notesMeta?.[key];
    const label = meta?.label ?? "Untitled Note";

    files.push({
      key: `note:${key}`,
      label,
      shortLabel: truncateSourceName(label),
      icon: "note",
      group: "note",
      ...(meta?.folder ? { folder: meta.folder } : {}),
    });
  }

  // Papers
  const paperKeys = Object.keys(artifacts.papers || {});
  for (const key of paperKeys) {
    if (artifacts.papers[key]?.trim()) {
      // Extract title from LaTeX \title{...} or use a default
      const titleMatch = artifacts.papers[key].match(/\\title\{([^}]+)\}/);
      const label = titleMatch?.[1]?.replace(/\\\\$/g, "").trim() || "Untitled Paper";

      files.push({
        key: `paper:${key}`,
        label,
        shortLabel: truncateSourceName(label),
        icon: "paper",
        group: "paper",
        fileType: "latex",
      });
    }
  }

  // Experiments
  const experimentKeys = Object.keys(artifacts.experiments || {});
  for (const key of experimentKeys) {
    if (artifacts.experiments[key]?.trim()) {
      const meta = experimentsMeta?.[key];
      const label = meta?.title || "Untitled Experiment";

      files.push({
        key: `experiment:${key}`,
        label,
        shortLabel: truncateSourceName(label),
        icon: "experiment",
        group: "experiment",
      });
    }
  }

  // Sources
  const sourceKeys = Object.keys(artifacts.sources || {});
  for (const key of sourceKeys) {
    if (artifacts.sources[key]?.trim()) {
      const meta = sourcesMeta?.[key];
      const rawName = meta?.name ?? key;
      const origin = meta?.origin ?? "uploaded";

      files.push({
        key: `source:${key}`,
        label: rawName,
        shortLabel: truncateSourceName(rawName),
        icon: origin === "discovered" ? "source-discovered" : "source-uploaded",
        group: "source",
        origin,
        ...(meta?.folder ? { folder: meta.folder } : {}),
        ...(meta?.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
        ...(meta?.paperQuality ? { paperQuality: meta.paperQuality } : {}),
      });
    }
  }

  return files;
}

export function getArtifactContent(
  artifacts: Artifacts,
  fileKey: string
): string {
  if (fileKey.startsWith("paper:")) {
    const paperId = fileKey.slice(6);
    return artifacts.papers?.[paperId] ?? "";
  }
  if (fileKey.startsWith("note:")) {
    const noteId = fileKey.slice(5);
    return artifacts.notes?.[noteId] ?? "";
  }
  if (fileKey.startsWith("experiment:")) {
    const experimentId = fileKey.slice(11);
    return artifacts.experiments?.[experimentId] ?? "";
  }
  if (fileKey.startsWith("source:")) {
    const sourceKey = fileKey.slice(7);
    return artifacts.sources?.[sourceKey] ?? "";
  }
  return (artifacts[fileKey as keyof Artifacts] as string) ?? "";
}
