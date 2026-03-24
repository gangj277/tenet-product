"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskState } from "@/lib/agent/state";

function TaskStatusGlyph({ status }: { status: TaskState["status"] }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case "active":
      return (
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full border border-accent-fill/40 bg-page/80">
          <span className="h-2 w-2 rounded-full bg-accent-fill shadow-[0_0_10px_color-mix(in_srgb,var(--t-accent)_28%,transparent)]" />
        </span>
      );
    default:
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-edge/40 bg-page/75" />
      );
  }
}

function SummaryIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] text-sub"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4" cy="6" r="1.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.25 12.1l.85.85 1.65-1.9" />
      <circle cx="4" cy="18" r="1.75" />
    </svg>
  );
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

  const completed = tasks.filter((task) => task.status === "completed").length;
  const total = tasks.length;
  const allDone = total > 0 && completed === total;
  const activeTask = tasks.find((task) => task.status === "active") ?? null;
  const nextTask = tasks.find((task) => task.status === "pending") ?? null;

  useEffect(() => {
    if (tasks.length > 0 && tasks.length !== prevTaskCountRef.current) {
      setExpanded(true);
      setDismissed(false);
    }
    prevTaskCountRef.current = tasks.length;
  }, [tasks.length]);

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
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [allDone, onDismiss]);

  if (dismissed || total === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 px-3 pb-1 pt-2">
      <div
        className="overflow-hidden rounded-[26px] border border-edge/20 bg-panel/90"
        style={{
          boxShadow:
            "0 12px 30px color-mix(in srgb, var(--t-shadow) 7%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(14px) saturate(125%)",
        }}
      >
        <button
          onClick={() => setExpanded((value) => !value)}
          className="relative w-full cursor-pointer px-5 py-4 text-left transition-colors hover:bg-white/[0.025]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-edge/20 bg-page/80">
              <SummaryIcon />
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[11px] leading-none text-dim">
                {completed} out of {total} tasks completed
              </div>
              {!allDone && activeTask && (
                <div className="mt-1 text-[10.5px] leading-none text-mute">
                  In progress: {activeTask.objective}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <svg
                className={`h-4 w-4 text-mute transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
              </svg>
            </div>
          </div>
        </button>

        <div
          className="overflow-hidden transition-[max-height,opacity] duration-250 ease-out"
          style={{ maxHeight: expanded ? `${Math.max(total * 78, 180)}px` : "0px", opacity: expanded ? 1 : 0 }}
        >
          <div className="border-t border-edge/20 px-5 pb-4 pt-1">
            <div className="space-y-2">
              {tasks.map((task, index) => {
                const isActive = task.status === "active";
                return (
                  <div
                    key={task.id}
                    className={`relative rounded-2xl px-0 py-1.5 transition-colors ${
                      isActive ? "bg-accent-fill/[0.035]" : ""
                    }`}
                  >
                    {isActive && (
                      <span
                        className="pointer-events-none absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-accent-fill/70"
                      />
                    )}

                    <div className="flex items-start gap-3 pl-0.5">
                      <TaskStatusGlyph status={task.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <span className="mt-[1px] text-[13px] font-medium leading-none text-sub">
                            {index + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-[13px] leading-[1.22] ${
                                task.status === "completed"
                                  ? "text-dim"
                                  : isActive
                                    ? "text-heading font-medium"
                                    : "text-heading"
                              }`}
                            >
                              {task.objective}
                            </div>
                            {(task.result || isActive) && (
                              <div className="mt-1 text-[10px] leading-[1.45] text-dim">
                                {task.result
                                  ? task.result
                                  : isActive
                                    ? nextTask
                                      ? "Working through this step before moving to the next task."
                                      : "Working through the current step."
                                    : ""}
                              </div>
                            )}
                          </div>
                        </div>
                        {task.result && !isActive && (
                          <div className="pl-8" />
                        )}
                        {!task.result && task.status === "completed" && (
                          <div className="mt-0.5 pl-8 text-[10px] text-dim">
                            Completed
                          </div>
                        )}
                        {task.result && task.status === "completed" && (
                          <div className="mt-0.5 pl-8 text-[10px] leading-[1.4] text-dim">
                            {task.result
}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
