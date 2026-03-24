"use client";

import type { ExperimentSectionProps } from "../experiment-display";
import {
  AddButton,
  RemoveButton,
  SectionHeader,
} from "../experiment-primitives";
import {
  EditableTextarea,
} from "../experiment-editors";

export function ExperimentHypotheses({
  design,
  editing,
  updateDraft,
}: ExperimentSectionProps) {
  const d = design;

  return (
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
  );
}
