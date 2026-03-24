"use client";

import { MarkdownProse } from "../../../../../_components/markdown-prose";
import type { ExperimentSectionProps } from "../experiment-display";
import {
  Micro,
  ParamChip,
  SectionHeader,
} from "../experiment-primitives";
import {
  EditableField,
  EditableStringList,
  EditableTextarea,
} from "../experiment-editors";

export function ExperimentAnalysis({
  design,
  editing,
  updateDraft,
  sourceFiles,
  onNavigateSource,
}: ExperimentSectionProps) {
  const d = design;

  return (
    <>
      <section className="mb-10">
        <SectionHeader>Analysis Plan</SectionHeader>
        {editing ? (
          <div className="rounded-lg border border-edge/30 overflow-hidden">
            <div className="px-4 py-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Micro>Primary Test</Micro>
                  <EditableField
                    value={d.analysis.primaryTest}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        analysis: { ...prev.analysis, primaryTest: v },
                      }))
                    }
                    className="text-[12px] text-body mt-1"
                    placeholder="e.g. One-way ANOVA"
                  />
                </div>
                <div>
                  <Micro>Alpha</Micro>
                  <EditableField
                    value={d.analysis.alpha}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        analysis: { ...prev.analysis, alpha: v },
                      }))
                    }
                    className="text-[12px] text-body mt-1"
                    placeholder="e.g. .05"
                  />
                </div>
                <div>
                  <Micro>Effect Size</Micro>
                  <EditableField
                    value={d.analysis.effectSizeMeasure}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        analysis: {
                          ...prev.analysis,
                          effectSizeMeasure: v,
                        },
                      }))
                    }
                    className="text-[12px] text-body mt-1"
                    placeholder="e.g. Cohen's d"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-edge/20">
              <Micro>Missing Data Strategy</Micro>
              <EditableTextarea
                value={d.analysis.missingDataStrategy}
                onChange={(v) =>
                  updateDraft((prev) => ({
                    ...prev,
                    analysis: {
                      ...prev.analysis,
                      missingDataStrategy: v,
                    },
                  }))
                }
                className="mt-1"
                placeholder="How to handle attrition/incomplete data"
                rows={2}
              />
            </div>

            <div className="px-4 py-3 border-t border-edge/20">
              <Micro>Secondary Analyses</Micro>
              <EditableStringList
                items={d.analysis.secondaryAnalyses ?? []}
                onChange={(items) =>
                  updateDraft((prev) => ({
                    ...prev,
                    analysis: {
                      ...prev.analysis,
                      secondaryAnalyses: items.length ? items : undefined,
                    },
                  }))
                }
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-edge/30 overflow-hidden">
            <div className="px-4 py-3.5 flex flex-wrap items-center gap-2">
              <ParamChip label="Test" value={d.analysis.primaryTest} />
              <ParamChip label="\u03B1" value={d.analysis.alpha} />
              <ParamChip
                label="Effect"
                value={d.analysis.effectSizeMeasure}
              />
            </div>
            <div className="px-4 py-3 border-t border-edge/20">
              <Micro>Missing Data</Micro>
              <p className="text-[12.5px] text-body mt-1 leading-[1.6]">
                {d.analysis.missingDataStrategy}
              </p>
            </div>
            {d.analysis.secondaryAnalyses &&
              d.analysis.secondaryAnalyses.length > 0 && (
                <div className="px-4 py-3 border-t border-edge/20 bg-ink-950/[0.01] dark:bg-ink-50/[0.015]">
                  <Micro>Secondary Analyses</Micro>
                  <ul className="mt-1.5 space-y-1">
                    {d.analysis.secondaryAnalyses.map((analysis, i) => (
                      <li
                        key={i}
                        className="text-[12.5px] text-body leading-[1.6] flex items-start gap-2"
                      >
                        <span className="text-dim/60 mt-[3px] flex-shrink-0">
                          &#x2022;
                        </span>
                        <span>{analysis}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </section>

      {(d.limitations.length > 0 || editing) && (
        <section className="mb-10">
          <SectionHeader>Limitations</SectionHeader>
          {editing ? (
            <EditableStringList
              items={d.limitations}
              onChange={(items) =>
                updateDraft((prev) => ({ ...prev, limitations: items }))
              }
              placeholder="Limitation..."
            />
          ) : (
            <ul className="space-y-2">
              {d.limitations.map((limitation, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[13px] leading-[1.7] text-body"
                >
                  <span className="text-dim/50 mt-[5px] flex-shrink-0">
                    &#x2022;
                  </span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(d.ethics || editing) && (
        <section className="mb-6">
          <SectionHeader>Ethics</SectionHeader>
          {editing ? (
            <EditableTextarea
              value={d.ethics}
              onChange={(v) => updateDraft((prev) => ({ ...prev, ethics: v }))}
              placeholder="IRB requirements, informed consent, data privacy..."
              rows={4}
            />
          ) : (
            <div className="text-[13px] leading-[1.7] text-body">
              <MarkdownProse
                content={d.ethics}
                sourceFiles={sourceFiles}
                onSourceClick={onNavigateSource}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}
