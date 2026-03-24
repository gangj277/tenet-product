import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";

export const MAX_PROJECT_TITLE_LENGTH = 500;
export const DEFAULT_DRAFT_WORKSPACE_TITLE = "Untitled workspace";

export interface SourceMeta {
  name: string;
  origin: "uploaded" | "discovered";
  folder?: string;
  sourceUrl?: string;
  paperQuality?: PaperQualityMeta;
}

export interface NoteMeta {
  label: string;
  folder?: string;
}

export interface ExperimentMeta {
  title: string;
}

export type ResearchRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "awaiting_confirmation"
  | "failed"
  | "partial"
  | "completed";

export interface DashboardProjectRecord {
  id: string;
  runId: string | null;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnedRunRecord {
  runId: string;
  projectId: string;
  status: string;
  currentStep: string | null;
}

export function buildProjectTitle(researchQuestion: string): string {
  const normalized = researchQuestion.trim().replace(/\s+/g, " ");
  return normalized.slice(0, MAX_PROJECT_TITLE_LENGTH) || "Untitled research";
}

export function buildWorkspaceTitle(title?: string): string {
  const normalized = title?.trim().replace(/\s+/g, " ");
  return (
    normalized?.slice(0, MAX_PROJECT_TITLE_LENGTH) ||
    DEFAULT_DRAFT_WORKSPACE_TITLE
  );
}
