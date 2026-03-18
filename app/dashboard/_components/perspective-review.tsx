"use client";

import { useState } from "react";
import type { Perspective } from "@/lib/engine/state";

interface PerspectiveReviewProps {
  perspective: Perspective;
  onAccept: () => void;
  onEdit: (edited: Perspective) => void;
  disabled?: boolean;
}

export function PerspectiveReview({
  perspective,
  onAccept,
  onEdit,
  disabled,
}: PerspectiveReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Perspective>(perspective);

  const handleSubmitEdit = () => {
    onEdit(draft);
  };

  return (
    <div className="reveal space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-[6px] h-[6px] rounded-full bg-accent-fill animate-pulse" />
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
          Research brief — confirm or refine
        </p>
      </div>

      {/* Glass card */}
      <div className="glass-panel rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-edge/30 flex items-center justify-between">
          <span className="font-mono text-[12px] text-sub">
            Inferred perspective
          </span>
          {!isEditing && !disabled && (
            <button
              onClick={() => setIsEditing(true)}
              className="font-sans text-[12px] text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          {/* Brief summary */}
          <Field
            label="Summary"
            value={draft.briefSummary}
            editing={isEditing}
            onChange={(v) => setDraft({ ...draft, briefSummary: v })}
          />

          {/* Intent */}
          <Field
            label="Interpreted intent"
            value={draft.interpretedIntent}
            editing={isEditing}
            onChange={(v) => setDraft({ ...draft, interpretedIntent: v })}
          />

          {/* Research frame */}
          <Field
            label="Research frame"
            value={draft.inferredResearchFrame}
            editing={isEditing}
            onChange={(v) => setDraft({ ...draft, inferredResearchFrame: v })}
            multiline
          />

          {/* Subquestions */}
          <EditableList
            label="Subquestions to investigate"
            items={draft.subquestions}
            editing={isEditing}
            onChange={(items) => setDraft({ ...draft, subquestions: items })}
            numbered
          />

          {/* Evidence criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <EditableList
              label="Evidence for"
              items={draft.evidenceForCriteria}
              editing={isEditing}
              onChange={(items) => setDraft({ ...draft, evidenceForCriteria: items })}
              bullet="accent"
            />
            <EditableList
              label="Evidence against"
              items={draft.evidenceAgainstCriteria}
              editing={isEditing}
              onChange={(items) => setDraft({ ...draft, evidenceAgainstCriteria: items })}
              bullet="dot"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {isEditing ? (
          <>
            <button
              onClick={handleSubmitEdit}
              disabled={disabled}
              className="font-sans text-[13px] font-medium px-6 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-50 cursor-pointer"
            >
              Submit edits
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setDraft(perspective);
              }}
              className="font-sans text-[13px] text-sub hover:text-heading transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onAccept}
              disabled={disabled}
              className="font-sans text-[13px] font-medium px-6 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-50 cursor-pointer"
            >
              Looks good — start analysis
            </button>
            <button
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="font-sans text-[13px] text-sub hover:text-heading transition-colors disabled:opacity-50 cursor-pointer"
            >
              I want to refine this
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Small helpers ── */

function Field({
  label,
  value,
  editing,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-1.5">
        {label}
      </p>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-edge/50 rounded-md px-3 py-2 text-[13.5px] leading-[1.7] text-body focus:outline-none focus:border-accent/50 transition-colors resize-y"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent border-b border-edge/50 text-[13.5px] text-body py-0.5 focus:outline-none focus:border-accent/50 transition-colors"
          />
        )
      ) : (
        <p className="text-[13.5px] leading-[1.7] text-body">{value}</p>
      )}
    </div>
  );
}

function EditableList({
  label,
  items,
  editing,
  onChange,
  numbered,
  bullet,
}: {
  label: string;
  items: string[];
  editing: boolean;
  onChange: (items: string[]) => void;
  numbered?: boolean;
  bullet?: "accent" | "dot";
}) {
  if (items.length === 0 && !editing) return null;

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };

  const bulletColor = bullet === "dot" ? "text-dot" : "text-accent";

  return (
    <div>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-2">
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 group/item">
            {numbered ? (
              <span className="font-serif text-[13px] text-accent leading-[1.6] flex-shrink-0">
                {i + 1}.
              </span>
            ) : (
              <span className={`${bulletColor} text-[10px] mt-1.5 flex-shrink-0`}>&#9670;</span>
            )}
            {editing ? (
              <>
                <input
                  value={item}
                  onChange={(e) => update(i, e.target.value)}
                  placeholder="Type here..."
                  className={`flex-1 bg-transparent border-b border-edge/50 ${numbered ? "text-[13px]" : "text-[12.5px]"} text-body py-0.5 focus:outline-none focus:border-accent/50 transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="opacity-0 group-hover/item:opacity-100 text-dim hover:text-red-400 transition-all flex-shrink-0 mt-0.5 cursor-pointer"
                  aria-label="Remove item"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </>
            ) : (
              <span className={`${numbered ? "text-[13px] text-body" : "text-[12.5px] text-sub"} leading-[1.6]`}>
                {item}
              </span>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <button
          type="button"
          onClick={add}
          className="mt-2 font-sans text-[12px] text-dim hover:text-accent transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add item
        </button>
      )}
    </div>
  );
}
