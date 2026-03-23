"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentProcessStep } from "../../../_lib/agent-process-trace";

// ─── Compact Process Trace ───────────────────────────────────────────────────
// Replaces the flat step list with a streamlined, ambient progress indicator.
// Default: shows only the active step + completed count.
// Expand: reveals the full timeline.

function StepDot({ status }: { status: AgentProcessStep["status"] }) {
  if (status === "completed") {
    return (
      <span className="w-[6px] h-[6px] rounded-full bg-emerald-400/80 flex-shrink-0" />
    );
  }
  if (status === "error") {
    return (
      <span className="w-[6px] h-[6px] rounded-full bg-red-400/80 flex-shrink-0" />
    );
  }
  return (
    <span className="relative w-[6px] h-[6px] flex-shrink-0">
      <span className="absolute inset-0 rounded-full bg-accent-fill/60 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-accent-fill" />
    </span>
  );
}

export function ProcessTraceCard({ steps }: { steps: AgentProcessStep[] }) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const activeStep = [...steps].reverse().find((s) => s.status === "active");
  const errorStep = [...steps].reverse().find((s) => s.status === "error");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "completed");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll expanded list to bottom when new steps appear
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length, expanded]);

  // Derive current display label
  const currentLabel = errorStep
    ? errorStep.label
    : activeStep
      ? activeStep.label
      : allDone
        ? "Done"
        : "Starting...";

  const currentDetail = (errorStep || activeStep)?.detail;

  return (
    <div className="mb-3 -mx-1">
      {/* ── Summary bar ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-edge/10 transition-colors cursor-pointer group"
      >
        {/* Animated progress dots */}
        <div className="flex items-center gap-[3px] flex-shrink-0">
          {allDone ? (
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : errorStep ? (
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
            </svg>
          ) : (
            <>
              {/* Mini dots showing progress */}
              {steps.slice(-5).map((s, i) => (
                <StepDot key={i} status={s.status} />
              ))}
            </>
          )}
        </div>

        {/* Label */}
        <span className={`text-[11px] flex-1 text-left truncate ${
          errorStep ? "text-red-300" : allDone ? "text-emerald-400/80" : "text-sub"
        }`}>
          {currentLabel}
          {currentDetail && !allDone && (
            <span className="text-dim ml-1">· {currentDetail}</span>
          )}
        </span>

        {/* Count + chevron */}
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {steps.length > 1 && (
            <span className="text-[9px] font-mono text-dim tabular-nums">
              {completedCount}/{steps.length}
            </span>
          )}
          <svg
            className={`w-2.5 h-2.5 text-mute transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 16 16" fill="currentColor"
          >
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
          </svg>
        </span>
      </button>

      {/* ── Expanded timeline ── */}
      {expanded && (
        <div
          ref={scrollRef}
          className="mt-1 ml-2 pl-3 border-l border-edge/20 space-y-0 max-h-[200px] overflow-y-auto scrollbar-thin"
        >
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-2 py-[3px] ${
                index === steps.length - 1 ? "" : ""
              }`}
            >
              <div className="mt-[5px] flex-shrink-0">
                <StepDot status={step.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10.5px] leading-snug truncate ${
                      step.status === "completed"
                        ? "text-dim"
                        : step.status === "error"
                          ? "text-red-300"
                          : "text-sub"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.kind === "tool" && (
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-dim/60 bg-edge/10 px-1 py-[1px] rounded">
                      tool
                    </span>
                  )}
                </div>
                {step.detail && (
                  <p className="text-[9.5px] text-dim leading-snug truncate">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
