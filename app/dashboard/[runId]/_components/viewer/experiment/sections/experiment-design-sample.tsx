"use client";

import type { ExperimentSectionProps } from "../experiment-display";
import {
  AddButton,
  DetailBlock,
  KeyValue,
  Micro,
  RemoveButton,
  SectionHeader,
} from "../experiment-primitives";
import {
  EditableField,
  EditableTextarea,
} from "../experiment-editors";

export function ExperimentDesignSample({
  design,
  editing,
  updateDraft,
}: ExperimentSectionProps) {
  const d = design;

  return (
    <>
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
    </>
  );
}
