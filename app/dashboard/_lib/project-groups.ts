export interface DashboardProjectListItem {
  id: string;
  runId: string | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_MAP: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  draft: { label: "Draft", color: "text-sky-400", dotColor: "bg-sky-400" },
  queued: { label: "Queued", color: "text-dim", dotColor: "bg-dim/50" },
  running: { label: "Running", color: "text-amber-500", dotColor: "bg-amber-500" },
  awaiting_confirmation: {
    label: "Review",
    color: "text-violet-400",
    dotColor: "bg-violet-400",
  },
  completed: { label: "Complete", color: "text-emerald-400", dotColor: "bg-emerald-400" },
  failed: { label: "Failed", color: "text-red-400", dotColor: "bg-red-400" },
  partial: { label: "Partial", color: "text-amber-400", dotColor: "bg-amber-400" },
};

export function groupProjectsByStatus(projects: DashboardProjectListItem[]) {
  return {
    drafts: projects.filter((project) => project.status === "draft"),
    active: projects.filter(
      (project) =>
        project.status === "running" ||
        project.status === "awaiting_confirmation"
    ),
    completed: projects.filter(
      (project) =>
        project.status !== "draft" &&
        project.status !== "running" &&
        project.status !== "awaiting_confirmation"
    ),
  };
}
