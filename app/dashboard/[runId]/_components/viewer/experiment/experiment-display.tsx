"use client";

import { MarkdownProse } from "../../../../_components/markdown-prose";
import type { LineRange, SourceRef } from "../../../../_lib/citation-utils";
import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import {
  AddButton,
  DetailBlock,
  KeyValue,
  Micro,
  ParamChip,
  RemoveButton,
  SectionHeader,
} from "./experiment-primitives";
import {
  EditableField,
  EditableStringList,
  EditableTagList,
  EditableTextarea,
} from "./experiment-editors";

export function ExperimentDisplay({
  design,
  editing,
  updateDraft,
  sourceFiles,
  onNavigateSource,
}: {
  design: ExperimentDesign;
  editing: boolean;
  updateDraft: (updater: (draft: ExperimentDesign) => ExperimentDesign) => void;
  sourceFiles?: SourceRef[];
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
}) {
  const d = design;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[740px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        <header className="mb-10">
          {editing ? (
            <>
              <EditableField
                value={d.title}
                onChange={(v) => updateDraft((prev) => ({ ...prev, title: v }))}
                className="font-serif text-[22px] font-medium text-heading tracking-[-0.01em] leading-[1.35]"
                placeholder="Experiment title"
              />
              <div className="mt-5 pl-4 border-l-2 border-accent-fill/40">
                <EditableTextarea
                  value={d.researchQuestion}
                  onChange={(v) =>
                    updateDraft((prev) => ({ ...prev, researchQuestion: v }))
                  }
                  className="font-serif text-[15px] leading-[1.7] text-heading/90"
                  placeholder="Research question"
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="font-serif text-[22px] font-medium text-heading tracking-[-0.01em] leading-[1.35]">
                {d.title}
              </h1>
              <div className="mt-5 pl-4 border-l-2 border-accent-fill/40">
                <p className="font-serif text-[15px] leading-[1.7] text-heading/90 italic">
                  {d.researchQuestion}
                </p>
              </div>
            </>
          )}
        </header>

        {(d.motivation || editing) && (
          <section className="mb-10">
            <SectionHeader>Motivation</SectionHeader>
            {editing ? (
              <EditableTextarea
                value={d.motivation}
                onChange={(v) => updateDraft((prev) => ({ ...prev, motivation: v }))}
                placeholder="Why this experiment matters..."
                rows={4}
              />
            ) : (
              <div className="text-[13.5px] leading-[1.78] text-body">
                <MarkdownProse
                  content={d.motivation}
                  sourceFiles={sourceFiles}
                  onSourceClick={onNavigateSource}
                />
              </div>
            )}
          </section>
        )}

        <section className="mb-10">
          <SectionHeader>Hypotheses</SectionHeader>
          <div className="space-y-3">
            {d.hypotheses.map((h, i) => (
              <div
                key={i}
                className={`rounded-lg border px-4 py-3.5 ${
                  h.type === "null"
                    ? "border-edge/30 bg-ink-950/[0.015] dark:bg-ink-50/[0.02]"
                    : "border-accent-fill/25 bg-accent-fill/[0.04]"
                }`}
              >
                {editing ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        value={h.id}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateDraft((prev) => {
                            const next = { ...prev, hypotheses: [...prev.hypotheses] };
                            next.hypotheses[i] = { ...next.hypotheses[i], id: value };
                            return next;
                          });
                        }}
                        className="w-20 bg-transparent border-b border-edge/50 font-mono text-[12px] font-semibold text-body py-0.5 focus:outline-none focus:border-accent/50 transition-colors"
                        placeholder="H0"
                      />
                      <select
                        value={h.type}
                        onChange={(e) => {
                          const value = e.target.value as "null" | "alternative";
                          updateDraft((prev) => {
                            const next = { ...prev, hypotheses: [...prev.hypotheses] };
                            next.hypotheses[i] = { ...next.hypotheses[i], type: value };
                            return next;
                          });
                        }}
                        className="bg-transparent border border-edge/40 rounded text-[11px] font-medium text-body px-1.5 py-0.5 focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                      >
                        <option value="null">null</option>
                        <option value="alternative">alternative</option>
                      </select>
                      <div className="flex-1" />
                      <RemoveButton
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            hypotheses: prev.hypotheses.filter((_, j) => j !== i),
                          }))
                        }
                      />
                    </div>
                    <EditableTextarea
                      value={h.statement}
                      onChange={(value) => {
                        updateDraft((prev) => {
                          const next = { ...prev, hypotheses: [...prev.hypotheses] };
                          next.hypotheses[i] = {
                            ...next.hypotheses[i],
                            statement: value,
                          };
                          return next;
                        });
                      }}
                      placeholder="Hypothesis statement..."
                      rows={2}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`font-mono text-[12px] font-semibold ${
                          h.type === "null" ? "text-dim" : "text-accent"
                        }`}
                      >
                        {h.id}
                      </span>
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-[1px] rounded ${
                          h.type === "null"
                            ? "text-mute bg-ink-950/[0.04] dark:bg-ink-50/[0.06]"
                            : "text-accent/70 bg-accent-fill/[0.08]"
                        }`}
                      >
                        {h.type}
                      </span>
                    </div>
                    <p className="text-[13.5px] leading-[1.7] text-body">
                      {h.statement}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <AddButton
              label="Add hypothesis"
              onClick={() =>
                updateDraft((prev) => ({
                  ...prev,
                  hypotheses: [
                    ...prev.hypotheses,
                    {
                      id: `H${prev.hypotheses.length}`,
                      type: "alternative",
                      statement: "",
                    },
                  ],
                }))
              }
            />
          )}
        </section>

        <section className="mb-10">
          <SectionHeader>Variables</SectionHeader>
          <div className="rounded-lg border border-edge/30 overflow-hidden divide-y divide-edge/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-edge/20">
              <div className="px-4 py-4">
                <Micro>Independent</Micro>
                <div className="mt-3 space-y-4">
                  {d.variables.independent.map((iv, i) =>
                    editing ? (
                      <div
                        key={i}
                        className="space-y-1.5 pb-3 border-b border-edge/15 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <EditableField
                            value={iv.name}
                            onChange={(v) =>
                              updateDraft((prev) => {
                                const independent = [...prev.variables.independent];
                                independent[i] = { ...independent[i], name: v };
                                return {
                                  ...prev,
                                  variables: { ...prev.variables, independent },
                                };
                              })
                            }
                            className="text-[13px] font-medium text-heading"
                            placeholder="Variable name"
                          />
                          <RemoveButton
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  independent: prev.variables.independent.filter(
                                    (_, j) => j !== i
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <EditableField
                          value={iv.description}
                          onChange={(v) =>
                            updateDraft((prev) => {
                              const independent = [...prev.variables.independent];
                              independent[i] = {
                                ...independent[i],
                                description: v,
                              };
                              return {
                                ...prev,
                                variables: { ...prev.variables, independent },
                              };
                            })
                          }
                          className="text-[12px] text-sub"
                          placeholder="Description"
                        />
                        <EditableTagList
                          items={iv.levels}
                          onChange={(levels) =>
                            updateDraft((prev) => {
                              const independent = [...prev.variables.independent];
                              independent[i] = { ...independent[i], levels };
                              return {
                                ...prev,
                                variables: { ...prev.variables, independent },
                              };
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div key={i}>
                        <p className="text-[13px] font-medium text-heading leading-snug">
                          {iv.name}
                        </p>
                        <p className="text-[12px] text-sub mt-1 leading-[1.6]">
                          {iv.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {iv.levels.map((level, j) => (
                            <span
                              key={j}
                              className="text-[11px] text-body font-medium px-2 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03]"
                            >
                              {level}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
                {editing && (
                  <AddButton
                    label="Add variable"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        variables: {
                          ...prev.variables,
                          independent: [
                            ...prev.variables.independent,
                            { name: "", description: "", levels: [] },
                          ],
                        },
                      }))
                    }
                  />
                )}
              </div>

              <div className="px-4 py-4">
                <Micro>Dependent</Micro>
                <div className="mt-3 space-y-4">
                  {d.variables.dependent.map((dv, i) =>
                    editing ? (
                      <div
                        key={i}
                        className="space-y-1.5 pb-3 border-b border-edge/15 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <EditableField
                            value={dv.name}
                            onChange={(v) =>
                              updateDraft((prev) => {
                                const dependent = [...prev.variables.dependent];
                                dependent[i] = { ...dependent[i], name: v };
                                return {
                                  ...prev,
                                  variables: { ...prev.variables, dependent },
                                };
                              })
                            }
                            className="text-[13px] font-medium text-heading"
                            placeholder="Variable name"
                          />
                          <RemoveButton
                            onClick={() =>
                              updateDraft((prev) => ({
                                ...prev,
                                variables: {
                                  ...prev.variables,
                                  dependent: prev.variables.dependent.filter(
                                    (_, j) => j !== i
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <EditableField
                          value={dv.measure}
                          onChange={(v) =>
                            updateDraft((prev) => {
                              const dependent = [...prev.variables.dependent];
                              dependent[i] = { ...dependent[i], measure: v };
                              return {
                                ...prev,
                                variables: { ...prev.variables, dependent },
                              };
                            })
                          }
                          className="text-[12px] text-sub"
                          placeholder="Measure"
                        />
                        <EditableField
                          value={dv.instrument ?? ""}
                          onChange={(v) =>
                            updateDraft((prev) => {
                              const dependent = [...prev.variables.dependent];
                              dependent[i] = {
                                ...dependent[i],
                                instrument: v || undefined,
                              };
                              return {
                                ...prev,
                                variables: { ...prev.variables, dependent },
                              };
                            })
                          }
                          className="text-[11px] text-dim font-mono"
                          placeholder="Instrument (optional)"
                        />
                      </div>
                    ) : (
                      <div key={i}>
                        <p className="text-[13px] font-medium text-heading leading-snug">
                          {dv.name}
                        </p>
                        <p className="text-[12px] text-sub mt-1 leading-[1.6]">
                          {dv.measure}
                        </p>
                        {dv.instrument && (
                          <p className="text-[11px] text-dim mt-1 font-mono">
                            {dv.instrument}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
                {editing && (
                  <AddButton
                    label="Add variable"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        variables: {
                          ...prev.variables,
                          dependent: [
                            ...prev.variables.dependent,
                            { name: "", measure: "" },
                          ],
                        },
                      }))
                    }
                  />
                )}
              </div>
            </div>

            {(d.variables.controls.length > 0 || editing) && (
              <div className="px-4 py-3.5 bg-ink-950/[0.01] dark:bg-ink-50/[0.015]">
                <Micro>Controls</Micro>
                <div className="mt-2 space-y-1.5">
                  {d.variables.controls.map((control, i) =>
                    editing ? (
                      <div key={i} className="flex items-center gap-2 group/item">
                        <EditableField
                          value={control.name}
                          onChange={(v) =>
                            updateDraft((prev) => {
                              const controls = [...prev.variables.controls];
                              controls[i] = { ...controls[i], name: v };
                              return {
                                ...prev,
                                variables: { ...prev.variables, controls },
                              };
                            })
                          }
                          className="text-[12px] font-medium text-heading w-32 flex-shrink-0"
                          placeholder="Name"
                        />
                        <span className="text-edge flex-shrink-0">&mdash;</span>
                        <EditableField
                          value={control.rationale}
                          onChange={(v) =>
                            updateDraft((prev) => {
                              const controls = [...prev.variables.controls];
                              controls[i] = { ...controls[i], rationale: v };
                              return {
                                ...prev,
                                variables: { ...prev.variables, controls },
                              };
                            })
                          }
                          className="text-[12px] text-sub flex-1"
                          placeholder="Rationale"
                        />
                        <RemoveButton
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              variables: {
                                ...prev.variables,
                                controls: prev.variables.controls.filter(
                                  (_, j) => j !== i
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <div key={i} className="flex items-baseline gap-2 text-[12px]">
                        <span className="font-medium text-heading whitespace-nowrap">
                          {control.name}
                        </span>
                        <span className="text-edge">&mdash;</span>
                        <span className="text-sub leading-[1.55]">
                          {control.rationale}
                        </span>
                      </div>
                    )
                  )}
                </div>
                {editing && (
                  <AddButton
                    label="Add control"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        variables: {
                          ...prev.variables,
                          controls: [
                            ...prev.variables.controls,
                            { name: "", rationale: "" },
                          ],
                        },
                      }))
                    }
                  />
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mb-10">
          <SectionHeader>Design &amp; Sample</SectionHeader>

          {editing ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <Micro>Design Type</Micro>
                  <EditableField
                    value={d.design.type}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        design: { ...prev.design, type: v },
                      }))
                    }
                    className="text-[12px] font-medium text-body mt-1"
                    placeholder="e.g. Between-subjects RCT"
                  />
                </div>
                <div>
                  <Micro>Target N</Micro>
                  <input
                    type="number"
                    value={d.sample.targetN}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      updateDraft((prev) => ({
                        ...prev,
                        sample: {
                          ...prev.sample,
                          targetN: Number.isNaN(value) ? 0 : value,
                        },
                      }));
                    }}
                    className="w-full bg-transparent border-b border-edge/50 text-[12px] font-medium text-body py-0.5 mt-1 focus:outline-none focus:border-accent/50 transition-colors"
                    placeholder="120"
                  />
                </div>
                <div>
                  <Micro>Population</Micro>
                  <EditableField
                    value={d.sample.population}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        sample: { ...prev.sample, population: v },
                      }))
                    }
                    className="text-[12px] text-body mt-1"
                    placeholder="Target population"
                  />
                </div>
              </div>

              <div className="mb-5">
                <Micro>Design Justification</Micro>
                <EditableTextarea
                  value={d.design.justification}
                  onChange={(v) =>
                    updateDraft((prev) => ({
                      ...prev,
                      design: { ...prev.design, justification: v },
                    }))
                  }
                  className="mt-1"
                  placeholder="Why this design over alternatives..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Micro>Power Rationale</Micro>
                  <EditableTextarea
                    value={d.sample.powerRationale}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        sample: { ...prev.sample, powerRationale: v },
                      }))
                    }
                    className="mt-1"
                    placeholder="Effect size basis and power level"
                    rows={3}
                  />
                </div>
                <div>
                  <Micro>Recruitment</Micro>
                  <EditableTextarea
                    value={d.sample.recruitment}
                    onChange={(v) =>
                      updateDraft((prev) => ({
                        ...prev,
                        sample: { ...prev.sample, recruitment: v },
                      }))
                    }
                    className="mt-1"
                    placeholder="How participants will be found"
                    rows={3}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
                <span className="text-[12px] font-medium text-accent bg-accent-fill/[0.08] border border-accent-fill/20 px-2.5 py-[3px] rounded">
                  {d.design.type}
                </span>
                <KeyValue label="N" value={String(d.sample.targetN)} />
                <KeyValue label="Population" value={d.sample.population} />
              </div>

              <p className="text-[13px] leading-[1.7] text-sub italic mb-5 pl-4 border-l border-edge/25">
                {d.design.justification}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <DetailBlock
                  label="Power Rationale"
                  text={d.sample.powerRationale}
                />
                <DetailBlock label="Recruitment" text={d.sample.recruitment} />
              </div>
            </>
          )}
        </section>

        <section className="mb-10">
          <SectionHeader>Procedure</SectionHeader>
          {editing ? (
            <div className="space-y-2">
              {d.procedure.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 group/item">
                  <span className="text-[10px] font-semibold text-dim tabular-nums flex-shrink-0 mt-[7px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    value={step}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateDraft((prev) => {
                        const procedure = [...prev.procedure];
                        procedure[i] = value;
                        return { ...prev, procedure };
                      });
                    }}
                    className="flex-1 bg-transparent border-b border-edge/50 text-[13px] text-body py-0.5 focus:outline-none focus:border-accent/50 transition-colors"
                    placeholder="Procedure step..."
                  />
                  <RemoveButton
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        procedure: prev.procedure.filter((_, j) => j !== i),
                      }))
                    }
                  />
                </div>
              ))}
              <AddButton
                label="Add step"
                onClick={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    procedure: [...prev.procedure, ""],
                  }))
                }
              />
            </div>
          ) : (
            <div className="relative ml-3">
              <div className="absolute left-0 top-[10px] bottom-[10px] w-px bg-edge/25" />
              <div className="space-y-0">
                {d.procedure.map((step, i) => (
                  <div key={i} className="relative flex items-start gap-4 py-2">
                    <div className="relative -left-[3.5px] mt-[5px] w-[7px] h-[7px] rounded-full bg-edge dark:bg-ink-50/20 flex-shrink-0 ring-[3px] ring-page" />
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span className="text-[10px] font-semibold text-dim tabular-nums flex-shrink-0 mt-[1px]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[13px] leading-[1.65] text-body">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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
      </div>
    </div>
  );
}
