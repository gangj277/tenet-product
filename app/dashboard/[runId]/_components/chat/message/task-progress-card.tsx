"use client";

import type { TaskState } from "@/lib/agent/state";

function TaskStatusIcon({ status }: { status: TaskState["status"] }) {
  switch (status) {
    case "completed":
      return (
        <svg
          className="w-3.5 h-3.5 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case "active":
      return (
        <svg
          className="activity-spinner w-3.5 h-3.5 text-accent-fill"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            d="M12 2a10 10 0 019.95 9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <span className="w-3.5 h-3.5 rounded-full border border-edge/40 inline-block" />
      );
  }
}

export function TaskProgressCard({ tasks }: { tasks: TaskState[] }) {
  const completed = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="mt-2.5 rounded-lg border border-edge/40 bg-page/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">
          Task Plan
        </span>
        <span className="text-[10px] text-sub">
          {completed}/{tasks.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-2">
            <div className="mt-0.5 flex-shrink-0">
              <TaskStatusIcon status={task.status} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-[11.5px] leading-snug ${
                  task.status === "completed"
                    ? "text-dim line-through"
                    : task.status === "active"
                    ? "text-main"
                    : "text-sub"
                }`}
              >
                {task.objective}
              </p>
              {task.status === "completed" && task.result && (
                <p className="text-[10px] text-dim mt-0.5 leading-relaxed">
                  {task.result}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
