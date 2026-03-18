"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  runId: string | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const activeProjects = projects.filter(
    (p) => p.status === "running" || p.status === "awaiting_confirmation"
  );
  const completedProjects = projects.filter(
    (p) => p.status !== "running" && p.status !== "awaiting_confirmation"
  );

  return (
    <div className="max-w-[760px] mx-auto px-6 lg:px-8 pt-10 sm:pt-16 pb-16">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 reveal">
        <div>
          <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2.2rem)] leading-[1.15] tracking-[-0.02em] text-heading mb-1.5">
            Workspaces
          </h1>
          <p className="font-sans text-[13px] text-dim">
            {!loading && projects.length > 0
              ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : "Your research projects"}
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/new")}
          className="font-sans text-[13px] font-medium px-5 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent cursor-pointer shrink-0"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New research
          </span>
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-3 reveal">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel rounded-xl px-6 py-5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-4 bg-edge/30 rounded w-2/3 mb-3" />
              <div className="h-3 bg-edge/20 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && projects.length === 0 && (
        <div className="reveal">
          <div className="glass-panel rounded-2xl px-8 py-16 text-center">
            <div className="decorative-diamond mx-auto mb-6" />
            <h2 className="font-serif text-[20px] text-heading mb-2 tracking-[-0.01em]">
              No research yet
            </h2>
            <p className="font-sans text-[13.5px] text-sub mb-8 max-w-[36ch] mx-auto leading-[1.65]">
              Start your first structured research project.
              Tenet will build evidence maps and grounded synthesis.
            </p>
            <button
              onClick={() => router.push("/dashboard/new")}
              className="font-sans text-[14px] font-medium px-8 py-3 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent cursor-pointer"
            >
              Start research
            </button>
          </div>
        </div>
      )}

      {/* ── Active / in-progress projects ── */}
      {!loading && activeProjects.length > 0 && (
        <div className="mb-8 reveal">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
              In progress
            </span>
          </div>
          <div className="space-y-2">
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) =>
                  setProjects((prev) => prev.filter((p) => p.id !== id))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Completed projects ── */}
      {!loading && completedProjects.length > 0 && (
        <div className="reveal reveal-delay-1">
          {activeProjects.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
                Completed
              </span>
            </div>
          )}
          <div className="space-y-2">
            {completedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) =>
                  setProjects((prev) => prev.filter((p) => p.id !== id))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Status config ── */

const STATUS_MAP: Record<string, { label: string; color: string; dotColor: string }> = {
  queued: { label: "Queued", color: "text-dim", dotColor: "bg-dim/50" },
  running: { label: "Running", color: "text-amber-500", dotColor: "bg-amber-500" },
  awaiting_confirmation: { label: "Review", color: "text-violet-400", dotColor: "bg-violet-400" },
  completed: { label: "Complete", color: "text-emerald-400", dotColor: "bg-emerald-400" },
  failed: { label: "Failed", color: "text-red-400", dotColor: "bg-red-400" },
  partial: { label: "Partial", color: "text-amber-400", dotColor: "bg-amber-400" },
};

/* ── Project card ── */

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = STATUS_MAP[project.status] || STATUS_MAP.queued;
  const date = new Date(project.createdAt);
  const timeAgo = formatRelative(date);
  const href = project.runId ? `/dashboard/${project.runId}` : "/dashboard/new";
  const isActive = project.status === "running" || project.status === "awaiting_confirmation";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(project.id);
      }
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className={`group relative glass-panel rounded-xl transition-all duration-300 ${isActive ? "border-accent/15" : "hover:border-accent/20"}`}>
      <Link href={href} className="block px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-[15px] text-heading leading-[1.4] tracking-[-0.01em] group-hover:text-accent transition-colors truncate">
              {project.title}
            </h3>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${isActive ? "animate-pulse" : ""}`} />
                <span className={`font-sans text-[11px] font-medium ${status.color}`}>
                  {status.label}
                </span>
              </span>
              <span className="text-edge">·</span>
              <span className="font-sans text-[11px] text-mute">
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-mute group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </Link>

      {/* Delete button — visible on hover */}
      {!confirming && (
        <button
          onClick={(e) => {
            e.preventDefault();
            setConfirming(true);
          }}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-mute hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Remove project"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
          </svg>
        </button>
      )}

      {/* Confirm delete overlay */}
      {confirming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-xl bg-page/80 backdrop-blur-sm">
          <span className="font-sans text-[12px] text-sub">
            Delete this project?
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="font-sans text-[12px] font-medium px-3 py-1.5 bg-red-500/15 text-red-400 rounded-md hover:bg-red-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-sans text-[12px] font-medium px-3 py-1.5 text-dim hover:text-sub transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Time formatter ── */

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
