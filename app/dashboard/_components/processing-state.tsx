"use client";

import { useEffect, useState, useCallback } from "react";
import type { StepProgress } from "@/lib/storage/memory-store";

interface ProcessingStateProps {
  runId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function ProcessingState({
  runId,
  onComplete,
  onError,
}: ProcessingStateProps) {
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startTime] = useState(() => Date.now());

  // Poll for progress
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/init/${runId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.progress?.length) {
        setSteps(data.progress);
      }

      if (data.status === "completed" || data.status === "partial") {
        onComplete();
      } else if (data.status === "failed") {
        const lastError = data.errors?.[data.errors.length - 1];
        onError(lastError?.message || "Analysis failed");
      }
    } catch {
      // Silently retry on network errors
    }
  }, [runId, onComplete, onError]);

  useEffect(() => {
    poll(); // Initial fetch
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  // Elapsed time ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const currentStep = steps.find((s) => s.status === "running");
  const completedCount = steps.filter((s) => s.status === "completed").length;

  return (
    <div className="reveal max-w-[520px] mx-auto">
      {/* ── Header ── */}
      <div className="text-center mb-10">
        {/* Animated diamond — compact version */}
        <div className="relative w-8 h-8 mx-auto mb-5">
          <div
            className="absolute inset-0 rounded-[3px] bg-accent-fill/15"
            style={{
              transform: "rotate(45deg)",
              animation: "spin 4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            }}
          />
          <div
            className="absolute inset-1.5 rounded-[2px] bg-accent-fill/30"
            style={{
              transform: "rotate(45deg)",
              animation:
                "spin 4s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse",
            }}
          />
          <div
            className="absolute inset-3 rounded-[1px] bg-accent-fill"
            style={{ transform: "rotate(45deg)" }}
          />
        </div>

        <p className="font-sans text-[14px] text-heading mb-1">
          Analysis in progress
        </p>
        <p className="font-sans text-[12px] text-dim">
          {formatDuration(elapsedMs)}
          {completedCount > 0 &&
            ` \u00B7 ${completedCount}/${steps.length} steps complete`}
        </p>
      </div>

      {/* ── Step list ── */}
      <div className="space-y-0.5">
        {steps.map((step) => {
          const isExpanded = expandedStep === step.id;
          const hasDetail = !!step.detail || (step.subSteps && step.subSteps.length > 0);

          return (
            <div key={step.id}>
              {/* Step row */}
              <button
                onClick={() => {
                  if (hasDetail) setExpandedStep(isExpanded ? null : step.id);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200
                  ${hasDetail ? "cursor-pointer" : "cursor-default"}
                  ${isExpanded ? "bg-panel border border-edge/30" : "hover:bg-panel/50"}
                `}
              >
                {/* Status icon */}
                <StepIcon status={step.status} />

                {/* Label */}
                <span
                  className={`flex-1 font-sans text-[13px] transition-colors duration-300 ${
                    step.status === "running"
                      ? "text-heading font-medium"
                      : step.status === "completed"
                        ? "text-sub"
                        : step.status === "failed"
                          ? "text-red-400"
                          : "text-dim"
                  }`}
                >
                  {step.label}
                </span>

                {/* Duration badge */}
                {step.status === "completed" && step.startedAt && step.completedAt && (
                  <span className="font-mono text-[11px] text-dim">
                    {formatDuration(
                      new Date(step.completedAt).getTime() -
                        new Date(step.startedAt).getTime()
                    )}
                  </span>
                )}

                {/* Expand chevron */}
                {hasDetail && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`text-dim transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && hasDetail && (
                <div className="px-4 pb-3 pt-0">
                  <div className="ml-7 pl-3 border-l border-edge/30">
                    {/* Detail text */}
                    {step.detail && (
                      <p className="font-sans text-[12px] text-sub leading-[1.6] mb-2">
                        {step.detail}
                      </p>
                    )}

                    {/* Sub-steps */}
                    {step.subSteps && step.subSteps.length > 0 && (
                      <div className="space-y-1">
                        {step.subSteps.map((sub, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2"
                          >
                            <SubStepIcon status={sub.status} />
                            <span
                              className={`font-sans text-[11.5px] ${
                                sub.status === "running"
                                  ? "text-body"
                                  : sub.status === "completed"
                                    ? "text-sub"
                                    : "text-dim"
                              }`}
                            >
                              {sub.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Subtle ambient line ── */}
      {currentStep && (
        <div className="mt-8 mx-4 h-px bg-edge/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-fill/40 rounded-full"
            style={{
              animation: "progress-pulse 2.5s ease-in-out infinite",
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes progress-pulse {
          0%,
          100% {
            width: 20%;
            margin-left: 0%;
          }
          50% {
            width: 40%;
            margin-left: 60%;
          }
        }
      `}</style>
    </div>
  );
}

/* ── Icons ── */

function StepIcon({ status }: { status: StepProgress["status"] }) {
  if (status === "completed") {
    return (
      <div className="w-5 h-5 rounded-full bg-accent-fill/15 flex items-center justify-center flex-shrink-0">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-accent"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-accent-fill border-t-transparent animate-spin flex-shrink-0" />
    );
  }
  if (status === "failed") {
    return (
      <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-red-400"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div className="w-5 h-5 rounded-full border border-edge/60 flex-shrink-0" />
  );
}

function SubStepIcon({
  status,
}: {
  status: "pending" | "running" | "completed" | "failed";
}) {
  if (status === "completed") {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-accent flex-shrink-0"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "running") {
    return (
      <div className="w-2.5 h-2.5 rounded-full border border-accent-fill border-t-transparent animate-spin flex-shrink-0" />
    );
  }
  return (
    <div className="w-2 h-2 rounded-full bg-edge/60 flex-shrink-0" />
  );
}

/* ── Helpers ── */

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}
