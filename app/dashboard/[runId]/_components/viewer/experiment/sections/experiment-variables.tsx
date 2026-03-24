"use client";

import type { ExperimentSectionProps } from "../experiment-display";
import {
  AddButton,
  Micro,
  RemoveButton,
  SectionHeader,
} from "../experiment-primitives";
import {
  EditableField,
  EditableTagList,
} from "../experiment-editors";

export function ExperimentVariables({
  design,
  editing,
  updateDraft,
}: ExperimentSectionProps) {
  const d = design;

  return (
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
  );
}
