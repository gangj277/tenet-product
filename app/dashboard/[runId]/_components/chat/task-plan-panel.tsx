"use client";

import { useState, useEffect, useRef } from "react";
import type { TaskState } from "@/lib/agent/state";

function TaskStatusIcon({ status }: { status: TaskState["status"] }) {
  switch (status) {
    case "completed":
      return (
        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "active":
      return (
        <svg className="w-3 h-3 text-accent-fill animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    default:
      return <span className="w-3 h-3 rounded-full border border-edge/40 inline-block" />;
  }
}

export function TaskPlanPanel({
  tasks,
  onDismiss,
}: {
  tasks: TaskState[];
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const prevTaskCountRef = useRef(0);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const allDone = completed === total && total > 0;
  const activeTask = tasks.find((t) => t.status === "active");

  // Auto-expand when new plan arrives
  useEffect(() => {
    if (tasks.length > 0 && tasks.length !== prevTaskCountRef.current) {
      setExpanded(true);
      setDismissed(false);
    }
    prevTaskCountRef.current = tasks.length;
  }, [tasks.length]);

  // Auto-collapse when all done, auto-dismiss after 5s
  useEffect(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    if (allDone) {
      setExpanded(false);
      autoDismissTimerRef.current = setTimeout(() => {
        setDismissed(true);
        onDismiss();
      }, 5000);
    }

    return () => {
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [allDone, onDismiss]);

  if (dismissed || tasks.length === 0) return null;

  return (
    <div className="border-b border-edge/20 bg-page/60 backdrop-blur-sm">
      {/* Summary bar — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer group"
      >
        {/* Progress ring */}
        <div className="relative w-4 h-4 flex-shrink-0">
          <svg className="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-edge/20" />
            <circle
              cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={allDone ? "text-emerald-400" : "text-accent-fill"}
              strokeDasharray={`${(completed / Math.max(total, 1)) * 50.265} 50.265`}
              strokeLinecap="round"
            />
          </svg>
        </div>

        <span className="text-[11px] font-medium text-sub flex-1 text-left truncate">
          {allDone ? (
            <span className="text-emerald-400">All tasks complete</span>
          ) : activeTask ? (
            <>
              <span className="text-dim">Task {completed + 1}/{total}</span>
              <span className="text-mute mx-1.5">·</span>
              <span>{activeTask.objective}</span>
            </>
          ) : (
            <span className="text-dim">Task plan · {completed}/{total}</span>
          )}
        </span>

        {/* Chevron */}
        <svg
          className={`w-3 h-3 text-mute transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 16 16" fill="currentColor"
        >
          <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
        </svg>

        {/* Dismiss */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
            onDismiss();
          }}
          className="w-4 h-4 flex items-center justify-center rounded text-mute hover:text-sub hover:bg-edge/20 transition-colors"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
      </button>

      {/* Expanded task list */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: expanded ? `${tasks.length * 28 + 8}px` : "0px" }}
      >
        <div className="px-3 pb-2 space-y-0.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 py-0.5">
              <TaskStatusIcon status={task.status} />
              <span
                className={`text-[11px] leading-tight truncate ${
                  task.status === "completed"
                    ? "text-dim line-through"
                    : task.status === "active"
                      ? "text-heading"
                      : "text-sub"
                }`}
              >
                {task.objective}
              </span>
              {task.status === "completed" && task.result && (
                <span className="text-[9px] text-dim ml-auto flex-shrink-0 max-w-[120px] truncate">
                  {task.result}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
