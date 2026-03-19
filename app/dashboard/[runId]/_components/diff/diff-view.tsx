"use client";

import { useMemo, useState } from "react";
import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import { buildLineDiffModel } from "../../_lib/line-diff-model";

const MAX_VISIBLE_CHANGES = 60;

export function LineDiffView({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const model = useMemo(
    () =>
      buildLineDiffModel({
        oldText,
        newText,
        expanded,
        maxVisibleChanges: MAX_VISIBLE_CHANGES,
      }),
    [oldText, newText, expanded]
  );

  if (model.changedCount === 0) {
    return (
      <div className="text-[11px] text-dim italic py-2">No changes detected</div>
    );
  }

  return (
    <div className="rounded-md border border-edge/30 bg-surface/30 overflow-hidden">
      <div className="overflow-x-auto">
        <pre className="font-mono text-[11px] leading-[1.7] px-3 py-2">
          {model.visibleEntries.map((entry, i) => {
            if (entry === "separator") {
              return (
                <div key={`sep-${i}`} className="text-dim/40 select-none py-0.5">
                  ···
                </div>
              );
            }
            const line = entry;
            if (line.type === "removed") {
              return (
                <div key={i} className="bg-red-500/10 text-red-400 -mx-3 px-3">
                  <span className="select-none text-red-400/50 mr-2">−</span>
                  {line.text}
                </div>
              );
            }
            if (line.type === "added") {
              return (
                <div key={i} className="bg-emerald-500/10 text-emerald-400 -mx-3 px-3">
                  <span className="select-none text-emerald-400/50 mr-2">+</span>
                  {line.text}
                </div>
              );
            }
            return (
              <div key={i} className="text-sub/70">
                <span className="select-none text-transparent mr-2">&nbsp;</span>
                {line.text}
              </div>
            );
          })}
        </pre>
      </div>
      {!expanded && model.hiddenChanges > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-1.5 text-[10px] text-dim hover:text-sub border-t border-edge/20 transition-colors cursor-pointer"
        >
          +{model.hiddenChanges} more changes
        </button>
      )}
    </div>
  );
}

/* ── Structured experiment diff (inline, matches ExperimentDisplay layout) ── */

/** Highlight wrapper for changed text blocks */
function Removed({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-red-500/[0.06] dark:bg-red-500/[0.08] border-l-[3px] border-red-400/50 px-4 py-3 mb-1 [&_*]:line-through [&_*]:decoration-red-400/30 [&_*]:decoration-[1.5px]">
      {children}
    </div>
  );
}

function Added({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border-l-[3px] border-emerald-400/50 px-4 py-3 mb-1">
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[14px] font-medium text-heading tracking-[-0.005em] mb-4 flex items-center gap-2.5">
      <span>{children}</span>
      <span className="flex-1 h-px bg-edge/20" />
    </h2>
  );
}

function Micro({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-dim">
      {children}
    </span>
  );
}

/** Render a scalar field diff: if changed show old (red) + new (green), else show value normally */
function FieldInlineDiff({
  oldVal,
  newVal,
  render,
}: {
  oldVal: string;
  newVal: string;
  render: (val: string) => React.ReactNode;
}) {
  if (oldVal === newVal) return <>{render(oldVal)}</>;
  return (
    <>
      {oldVal && <Removed>{render(oldVal)}</Removed>}
      {newVal && <Added>{render(newVal)}</Added>}
    </>
  );
}

/** Render array items with diff highlighting */
function ArrayInlineDiff({
  oldItems,
  newItems,
  renderItem,
}: {
  oldItems: string[];
  newItems: string[];
  renderItem: (item: string, idx: number) => React.ReactNode;
}) {
  const removedSet = new Set(oldItems.filter((item) => !newItems.includes(item)));
  const addedSet = new Set(newItems.filter((item) => !oldItems.includes(item)));

  // Build display order: unchanged + removed from old, then added from new
  const entries: Array<{ text: string; status: "unchanged" | "removed" | "added" }> = [];
  for (const item of oldItems) {
    entries.push({ text: item, status: removedSet.has(item) ? "removed" : "unchanged" });
  }
  for (const item of newItems) {
    if (addedSet.has(item)) {
      entries.push({ text: item, status: "added" });
    }
  }

  return (
    <>
      {entries.map((entry, i) => {
        const content = renderItem(entry.text, i);
        if (entry.status === "removed") return <Removed key={`r-${i}`}>{content}</Removed>;
        if (entry.status === "added") return <Added key={`a-${i}`}>{content}</Added>;
        return <div key={`u-${i}`}>{content}</div>;
      })}
    </>
  );
}

export function ExperimentDiffView({
  oldDesign,
  newDesign,
}: {
  oldDesign: ExperimentDesign;
  newDesign: ExperimentDesign;
}) {
  const o = oldDesign;
  const n = newDesign;

  return (
    <>
      {/* Header */}
      <header className="mb-10">
        <FieldInlineDiff
          oldVal={o.title}
          newVal={n.title}
          render={(val) => (
            <h1 className="font-serif text-[22px] font-medium text-heading tracking-[-0.01em] leading-[1.35]">
              {val}
            </h1>
          )}
        />
        <div className="mt-5 pl-4 border-l-2 border-accent-fill/40">
          <FieldInlineDiff
            oldVal={o.researchQuestion}
            newVal={n.researchQuestion}
            render={(val) => (
              <p className="font-serif text-[15px] leading-[1.7] text-heading/90 italic">
                {val}
              </p>
            )}
          />
        </div>
      </header>

      {/* Motivation */}
      {(o.motivation || n.motivation) && (
        <section className="mb-10">
          <SectionHeader>Motivation</SectionHeader>
          <FieldInlineDiff
            oldVal={o.motivation}
            newVal={n.motivation}
            render={(val) => (
              <p className="text-[13.5px] leading-[1.78] text-body">{val}</p>
            )}
          />
        </section>
      )}

      {/* Hypotheses */}
      <section className="mb-10">
        <SectionHeader>Hypotheses</SectionHeader>
        <div className="space-y-3">
          <ArrayInlineDiff
            oldItems={o.hypotheses.map((h) => `[${h.type}] ${h.statement}`)}
            newItems={n.hypotheses.map((h) => `[${h.type}] ${h.statement}`)}
            renderItem={(item) => {
              const match = item.match(/^\[(null|alternative)\]\s([\s\S]+)$/);
              const type = (match?.[1] ?? "alternative") as "null" | "alternative";
              const statement = match?.[2] ?? item;
              return (
                <div
                  className={`rounded-lg border px-4 py-3.5 ${
                    type === "null"
                      ? "border-edge/30 bg-ink-950/[0.015] dark:bg-ink-50/[0.02]"
                      : "border-accent-fill/25 bg-accent-fill/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-[1px] rounded ${
                        type === "null"
                          ? "text-mute bg-ink-950/[0.04] dark:bg-ink-50/[0.06]"
                          : "text-accent/70 bg-accent-fill/[0.08]"
                      }`}
                    >
                      {type}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-[1.7] text-body">{statement}</p>
                </div>
              );
            }}
          />
        </div>
      </section>

      {/* Procedure */}
      <section className="mb-10">
        <SectionHeader>Procedure</SectionHeader>
        <div className="relative ml-3">
          <div className="absolute left-0 top-[10px] bottom-[10px] w-px bg-edge/25" />
          <div className="space-y-0">
            <ArrayInlineDiff
              oldItems={o.procedure}
              newItems={n.procedure}
              renderItem={(step, i) => (
                <div className="relative flex items-start gap-4 py-2">
                  <div className="relative -left-[3.5px] mt-[5px] w-[7px] h-[7px] rounded-full bg-edge dark:bg-ink-50/20 flex-shrink-0 ring-[3px] ring-page" />
                  <div className="flex items-baseline gap-2.5 min-w-0">
                    <span className="text-[10px] font-semibold text-dim tabular-nums flex-shrink-0 mt-[1px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13px] leading-[1.65] text-body">{step}</p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </section>

      {/* Design & Sample */}
      <section className="mb-10">
        <SectionHeader>Design &amp; Sample</SectionHeader>
        <FieldInlineDiff
          oldVal={`${o.design.type} | N=${o.sample.targetN} | ${o.sample.population}`}
          newVal={`${n.design.type} | N=${n.sample.targetN} | ${n.sample.population}`}
          render={(val) => {
            const parts = val.split(" | ");
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
                <span className="text-[12px] font-medium text-accent bg-accent-fill/[0.08] border border-accent-fill/20 px-2.5 py-[3px] rounded">
                  {parts[0]}
                </span>
                {parts[1] && (
                  <span className="text-[12px] text-sub">
                    <span className="text-dim">N:</span>{" "}
                    <span className="font-medium text-body">{parts[1].replace("N=", "")}</span>
                  </span>
                )}
                {parts[2] && (
                  <span className="text-[12px] text-sub">
                    <span className="text-dim">Population:</span>{" "}
                    <span className="font-medium text-body">{parts[2]}</span>
                  </span>
                )}
              </div>
            );
          }}
        />

        <FieldInlineDiff
          oldVal={o.design.justification}
          newVal={n.design.justification}
          render={(val) => (
            <p className="text-[13px] leading-[1.7] text-sub italic mb-5 pl-4 border-l border-edge/25">
              {val}
            </p>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Micro>Power Rationale</Micro>
            <FieldInlineDiff
              oldVal={o.sample.powerRationale}
              newVal={n.sample.powerRationale}
              render={(val) => (
                <p className="text-[12.5px] text-body mt-1.5 leading-[1.65]">{val}</p>
              )}
            />
          </div>
          <div>
            <Micro>Recruitment</Micro>
            <FieldInlineDiff
              oldVal={o.sample.recruitment}
              newVal={n.sample.recruitment}
              render={(val) => (
                <p className="text-[12.5px] text-body mt-1.5 leading-[1.65]">{val}</p>
              )}
            />
          </div>
        </div>
      </section>

      {/* Analysis Plan */}
      <section className="mb-10">
        <SectionHeader>Analysis Plan</SectionHeader>
        <div className="rounded-lg border border-edge/30 overflow-hidden">
          <FieldInlineDiff
            oldVal={`${o.analysis.primaryTest}|${o.analysis.alpha}|${o.analysis.effectSizeMeasure}`}
            newVal={`${n.analysis.primaryTest}|${n.analysis.alpha}|${n.analysis.effectSizeMeasure}`}
            render={(val) => {
              const [test, alpha, effect] = val.split("|");
              return (
                <div className="px-4 py-3.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03]">
                    <span className="text-dim font-medium">Test</span>
                    <span className="text-body font-medium">{test}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03]">
                    <span className="text-dim font-medium">{"\u03B1"}</span>
                    <span className="text-body font-medium">{alpha}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03]">
                    <span className="text-dim font-medium">Effect</span>
                    <span className="text-body font-medium">{effect}</span>
                  </span>
                </div>
              );
            }}
          />

          <div className="px-4 py-3 border-t border-edge/20">
            <Micro>Missing Data</Micro>
            <FieldInlineDiff
              oldVal={o.analysis.missingDataStrategy}
              newVal={n.analysis.missingDataStrategy}
              render={(val) => (
                <p className="text-[12.5px] text-body mt-1 leading-[1.6]">{val}</p>
              )}
            />
          </div>

          {((o.analysis.secondaryAnalyses?.length ?? 0) > 0 ||
            (n.analysis.secondaryAnalyses?.length ?? 0) > 0) && (
            <div className="px-4 py-3 border-t border-edge/20 bg-ink-950/[0.01] dark:bg-ink-50/[0.015]">
              <Micro>Secondary Analyses</Micro>
              <div className="mt-1.5 space-y-1">
                <ArrayInlineDiff
                  oldItems={o.analysis.secondaryAnalyses ?? []}
                  newItems={n.analysis.secondaryAnalyses ?? []}
                  renderItem={(item) => (
                    <div className="text-[12.5px] text-body leading-[1.6] flex items-start gap-2">
                      <span className="text-dim/60 mt-[3px] flex-shrink-0">&#x2022;</span>
                      <span>{item}</span>
                    </div>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Limitations */}
      {(o.limitations.length > 0 || n.limitations.length > 0) && (
        <section className="mb-10">
          <SectionHeader>Limitations</SectionHeader>
          <div className="space-y-2">
            <ArrayInlineDiff
              oldItems={o.limitations}
              newItems={n.limitations}
              renderItem={(item) => (
                <div className="flex items-start gap-2.5 text-[13px] leading-[1.7] text-body">
                  <span className="text-dim/50 mt-[5px] flex-shrink-0">&#x2022;</span>
                  <span>{item}</span>
                </div>
              )}
            />
          </div>
        </section>
      )}

      {/* Ethics */}
      {(o.ethics || n.ethics) && (
        <section className="mb-6">
          <SectionHeader>Ethics</SectionHeader>
          <FieldInlineDiff
            oldVal={o.ethics}
            newVal={n.ethics}
            render={(val) => (
              <p className="text-[13px] leading-[1.7] text-body">{val}</p>
            )}
          />
        </section>
      )}
    </>
  );
}
