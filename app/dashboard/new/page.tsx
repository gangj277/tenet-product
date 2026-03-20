"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UserInput, SourceEntry, Perspective } from "@/lib/engine/state";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import { FileUpload } from "../_components/file-upload";
import { PerspectiveReview } from "../_components/perspective-review";
import { ProcessingState } from "../_components/processing-state";
import { SearchFilterPanel } from "../_components/search-filter-panel";

type Phase =
  | "form"
  | "submitting"
  | "review"
  | "processing";

export default function DashboardPage() {
  const router = useRouter();

  // ── Form state ──
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState<Partial<UserInput>>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilterConfig>({});

  // ── Pipeline state ──
  const [phase, setPhase] = useState<Phase>("form");
  const [runId, setRunId] = useState<string | null>(null);
  const [perspective, setPerspective] = useState<Perspective | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Submit research question ──
  const handleSubmit = useCallback(async () => {
    if (!question.trim()) return;
    setError(null);
    setPhase("submitting");

    try {
      const hasFilters = Object.values(searchFilters).some(
        (v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
      );
      const input: UserInput = {
        researchQuestion: question.trim(),
        ...advanced,
        ...(hasFilters ? { searchFilters } : {}),
      };

      const res = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, sources }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start analysis");
      }

      const data = await res.json();
      setRunId(data.runId);
      setPerspective(data.perspective);
      setPhase("review");
    } catch (err) {
      setError((err as Error).message);
      setPhase("form");
    }
  }, [question, sources, advanced, searchFilters]);

  // ── Confirm perspective (fire-and-forget, then poll) ──
  const handleConfirm = useCallback(
    async (action: "accept" | "edit", edited?: Perspective) => {
      if (!runId) return;
      setError(null);
      setPhase("processing");

      try {
        const body: Record<string, unknown> = { action };
        if (action === "edit" && edited) body.perspective = edited;

        const res = await fetch(`/api/init/${runId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to start analysis");
        }

        // Confirm returns immediately — ProcessingState polls for progress
      } catch (err) {
        setError((err as Error).message);
        setPhase("review");
      }
    },
    [runId]
  );

  return (
    <div className="max-w-[640px] mx-auto px-6 lg:px-8">
      {/* ── FORM PHASE ── */}
      {(phase === "form" || phase === "submitting") && (
        <div className="pt-12 sm:pt-20">
          {/* Header */}
          <div className="mb-12 reveal">
            <h1 className="font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.15] tracking-[-0.025em] text-heading mb-4">
              What are you researching?
            </h1>
            <p className="font-sans text-[14px] leading-[1.7] text-sub max-w-[48ch]">
              Describe your research question. Upload papers if you have them.
              Lumen will build a structured analysis with grounded evidence.
            </p>
          </div>

          {/* Research question textarea */}
          <div className="reveal reveal-delay-1 mb-6">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Is model collapse an inevitable consequence of training on synthetic data, or can it be mitigated through data mixing strategies?"
              rows={4}
              disabled={phase === "submitting"}
              className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3.5 font-serif text-[15px] leading-[1.7] text-heading placeholder:text-dim/60 placeholder:font-sans placeholder:text-[14px] focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 resize-y disabled:opacity-50"
            />
          </div>

          {/* File upload */}
          <div className="reveal reveal-delay-2 mb-6">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim mb-3">
              Sources{" "}
              <span className="font-normal normal-case tracking-normal text-mute">
                — optional
              </span>
            </p>
            <FileUpload
              sources={sources}
              onSourcesChange={setSources}
              disabled={phase === "submitting"}
            />
          </div>

          {/* Advanced options toggle */}
          <div className="reveal reveal-delay-3 mb-8">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="font-sans text-[12px] text-dim hover:text-sub transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={`transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Advanced options
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 pl-0.5">
                <AdvancedField
                  label="Research intent"
                  placeholder="What do you hope to achieve with this research?"
                  value={advanced.researchIntent || ""}
                  onChange={(v) =>
                    setAdvanced({ ...advanced, researchIntent: v || undefined })
                  }
                />
                <AdvancedField
                  label="Working hypothesis"
                  placeholder="Your current best guess or thesis"
                  value={advanced.workingHypothesis || ""}
                  onChange={(v) =>
                    setAdvanced({
                      ...advanced,
                      workingHypothesis: v || undefined,
                    })
                  }
                />
                <AdvancedField
                  label="Scope boundaries"
                  placeholder="What's explicitly out of scope?"
                  value={advanced.scopeBoundaries || ""}
                  onChange={(v) =>
                    setAdvanced({
                      ...advanced,
                      scopeBoundaries: v || undefined,
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-4">
                  <AdvancedField
                    label="Audience"
                    placeholder="e.g. ML researchers"
                    value={advanced.audience || ""}
                    onChange={(v) =>
                      setAdvanced({ ...advanced, audience: v || undefined })
                    }
                  />
                  <AdvancedField
                    label="Time horizon"
                    placeholder="e.g. 2020–present"
                    value={advanced.timeHorizon || ""}
                    onChange={(v) =>
                      setAdvanced({ ...advanced, timeHorizon: v || undefined })
                    }
                  />
                </div>

                {/* Search filters */}
                <div className="pt-3 mt-3 border-t border-edge/20">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-3">
                    Source discovery filters
                  </p>
                  <SearchFilterPanel
                    filters={searchFilters}
                    onChange={setSearchFilters}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
              <p className="font-sans text-[13px] text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="reveal reveal-delay-4">
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || phase === "submitting"}
              className="font-sans text-[14px] font-medium px-8 py-3 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {phase === "submitting" ? (
                <span className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 border-2 border-on-accent/60 border-t-transparent rounded-full animate-spin" />
                  Analyzing question...
                </span>
              ) : (
                "Start research"
              )}
            </button>

            {sources.length > 0 && phase !== "submitting" && (
              <p className="font-sans text-[12px] text-dim mt-3">
                {sources.length} source{sources.length > 1 ? "s" : ""} attached
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── REVIEW PHASE ── */}
      {phase === "review" && perspective && (
        <div className="pt-12 sm:pt-20">
          <div className="mb-8">
            <p className="font-sans text-[13px] text-sub mb-2">
              Your question
            </p>
            <p className="font-serif text-[18px] leading-[1.4] text-heading tracking-[-0.01em]">
              {question}
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
              <p className="font-sans text-[13px] text-red-400">{error}</p>
            </div>
          )}

          <PerspectiveReview
            perspective={perspective}
            onAccept={() => handleConfirm("accept")}
            onEdit={(edited) => handleConfirm("edit", edited)}
          />
        </div>
      )}

      {/* ── PROCESSING PHASE ── */}
      {phase === "processing" && runId && (
        <div className="pt-12 sm:pt-20">
          <ProcessingState
            runId={runId}
            onComplete={() => router.push(`/dashboard/${runId}`)}
            onError={(msg) => {
              setError(msg);
              setPhase("review");
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Small helper ── */

function AdvancedField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim block mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-edge/40 text-[13px] text-body py-1.5 placeholder:text-dim/40 focus:outline-none focus:border-accent/40 transition-colors"
      />
    </div>
  );
}
