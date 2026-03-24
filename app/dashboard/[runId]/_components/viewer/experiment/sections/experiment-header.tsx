"use client";

import { MarkdownProse } from "../../../../../_components/markdown-prose";
import type { ExperimentSectionProps } from "../experiment-display";
import {
  SectionHeader,
} from "../experiment-primitives";
import {
  EditableField,
  EditableTextarea,
} from "../experiment-editors";

export function ExperimentHeader({
  design,
  editing,
  updateDraft,
  sourceFiles,
  onNavigateSource,
}: ExperimentSectionProps) {
  const d = design;

  return (
    <>
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
    </>
  );
}
