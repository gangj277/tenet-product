"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SKILL_LIST, type SkillInfo } from "../../_lib/skill-definitions";

/* ── Skill icon map ── */

const SKILL_ICONS: Record<string, string> = {
  "devils-advocate": "\u2694",   // crossed swords
  "source-scout": "\u2609",      // compass / sun symbol
  "paper-explainer": "\u273F",   // flower / asterisk
  "evidence-adjudicator": "\u2696", // scales
  "synthesis-updater": "\u2B21", // hexagon
  "methodology-critic": "\u2662", // diamond
};

function getIcon(id: string): string {
  return SKILL_ICONS[id] ?? "\u2726";
}

/* ── Props ── */

export interface SkillPickerProps {
  query: string;
  onSelect: (slash: string) => void;
  onClose: () => void;
}

/* ── Component ── */

export function SkillPicker({ query, onSelect, onClose }: SkillPickerProps) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  /* Filter skills against query */
  const filtered = useMemo(() => {
    if (!query) return SKILL_LIST;
    const q = query.toLowerCase();
    return SKILL_LIST.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slash.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [query]);

  /* Reset highlight when filter changes */
  useEffect(() => {
    setHighlightIdx(0);
  }, [filtered]);

  /* Scroll highlighted item into view */
  useEffect(() => {
    const el = itemRefs.current.get(highlightIdx);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  /* Keyboard handler — called by parent */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[highlightIdx]) {
          onSelect(filtered[highlightIdx].slash);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [filtered, highlightIdx, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 z-50" onMouseDown={(e) => e.preventDefault()}>
        <div
          className="glass-panel rounded-xl border border-edge/40 shadow-lg shadow-black/20 overflow-hidden"
          style={{
            background:
              "color-mix(in srgb, var(--t-panel) 97%, transparent)",
          }}
        >
          <div className="px-4 py-3.5 text-[11px] text-dim text-center tracking-wide">
            No matching skills
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50" onMouseDown={(e) => e.preventDefault()}>
      <div
        className="glass-panel rounded-xl border border-edge/40 overflow-hidden"
        style={{
          boxShadow:
            "0 -8px 40px -12px rgba(0,0,0,0.35), 0 -2px 12px -4px rgba(0,0,0,0.2), inset 0 1px 0 0 color-mix(in srgb, var(--t-heading) 4%, transparent)",
          background:
            "color-mix(in srgb, var(--t-panel) 97%, transparent)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
          <span className="text-[9.5px] font-medium text-mute uppercase tracking-[0.08em]">
            Skills
          </span>
          <span className="text-[9px] text-mute/60 tracking-wide">
            <kbd className="inline-block px-1 py-0.5 rounded bg-page/40 text-[8.5px] text-dim font-mono border border-edge/30">
              &uarr;&darr;
            </kbd>{" "}
            navigate{" "}
            <kbd className="inline-block px-1 py-0.5 rounded bg-page/40 text-[8.5px] text-dim font-mono border border-edge/30 ml-0.5">
              &crarr;
            </kbd>{" "}
            select
          </span>
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="max-h-[220px] overflow-y-auto py-1 px-1.5"
          role="listbox"
        >
          {filtered.map((skill, i) => {
            const isActive = i === highlightIdx;
            return (
              <button
                key={skill.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(i, el);
                  else itemRefs.current.delete(i);
                }}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(skill.slash)}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`
                  w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left
                  transition-colors duration-100 cursor-pointer group
                  ${
                    isActive
                      ? "bg-dot/8"
                      : "bg-transparent hover:bg-page/40"
                  }
                `}
              >
                {/* Icon */}
                <span
                  className={`
                    flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center
                    text-[13px] transition-colors duration-100 border
                    ${
                      isActive
                        ? "bg-dot/12 border-dot/20 text-dot"
                        : "bg-page/50 border-edge/30 text-dim group-hover:text-sub"
                    }
                  `}
                >
                  {getIcon(skill.id)}
                </span>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code
                      className={`
                        text-[11.5px] font-mono font-medium tracking-tight
                        transition-colors duration-100
                        ${isActive ? "text-dot" : "text-accent"}
                      `}
                    >
                      {skill.slash}
                    </code>
                    <span
                      className={`
                        text-[10.5px] font-medium transition-colors duration-100
                        ${isActive ? "text-heading" : "text-sub"}
                      `}
                    >
                      {skill.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-dim mt-0.5 truncate leading-snug">
                    {skill.description}
                  </p>
                </div>

                {/* Active indicator line */}
                {isActive && (
                  <span className="flex-shrink-0 w-[3px] h-4 rounded-full bg-dot/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
