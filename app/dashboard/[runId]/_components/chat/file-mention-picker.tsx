"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../../_lib/workspace-types";
import { FOLDER_ICON_PATH } from "../sidebar/sidebar-icons";
import { buildMentionEntries, type MentionEntry } from "./composer/mention-utils";

/* ── Icon paths — reused from file-sidebar ── */

const ICON_PATHS: Record<FileEntry["icon"], string> = {
  overview:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
  synthesis:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  claims: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  gaps: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
  "next-steps": "M13 7l5 5m0 0l-5 5m5-5H6",
  "source-uploaded":
    "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
  "source-discovered": "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  paper:
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  note:
    "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  experiment:
    "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.594-7.512a12.083 12.083 0 00-3.401-5.876M5 14.5l1.594-7.512a12.083 12.083 0 013.401-5.876",
};

/* ── Group badge colors ── */

const GROUP_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  core: { bg: "bg-accent-fill/10", text: "text-accent", label: "Artifact" },
  paper: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Paper" },
  source: { bg: "bg-violet-500/10", text: "text-violet-400", label: "Source" },
  note: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Note" },
  experiment: { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Experiment" },
  folder: { bg: "bg-slate-400/10", text: "text-slate-300", label: "Folder" },
};

/* ── Props ── */

export interface FileMentionPickerProps {
  query: string;
  files: FileEntry[];
  folderPaths: string[];
  onSelect: (entry: MentionEntry) => void;
  onClose: () => void;
}

/* ── Component ── */

export function FileMentionPicker({
  query,
  files,
  folderPaths,
  onSelect,
  onClose,
}: FileMentionPickerProps) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const entries = useMemo(
    () => buildMentionEntries(files, folderPaths),
    [files, folderPaths]
  );

  /* Filter entries against query */
  const filtered = useMemo(() => {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.shortLabel.toLowerCase().includes(q) ||
        (entry.type === "file" && entry.key.toLowerCase().includes(q)) ||
        (entry.type === "folder" && entry.path.toLowerCase().includes(q))
    );
  }, [entries, query]);
  const activeHighlightIdx =
    filtered.length === 0 ? 0 : Math.min(highlightIdx, filtered.length - 1);

  /* Scroll highlighted item into view */
  useEffect(() => {
    const el = itemRefs.current.get(activeHighlightIdx);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeHighlightIdx]);

  /* Keyboard handler */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((prev) =>
          filtered.length > 0 ? (prev + 1) % filtered.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlightIdx((prev) =>
          filtered.length > 0
            ? (prev - 1 + filtered.length) % filtered.length
            : 0
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[activeHighlightIdx]) {
          onSelect(filtered[activeHighlightIdx]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [activeHighlightIdx, filtered, onClose, onSelect]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
        <div
          className="glass-panel rounded-xl border border-edge/40 shadow-lg shadow-black/20 overflow-hidden"
          style={{
            background:
              "color-mix(in srgb, var(--t-panel) 96%, transparent)",
          }}
        >
          <div className="px-4 py-3.5 text-[11px] text-dim text-center tracking-wide">
            No matching files
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div
        className="glass-panel rounded-xl border border-edge/40 overflow-hidden"
        style={{
          boxShadow:
            "0 -8px 40px -12px rgba(0,0,0,0.35), 0 -2px 12px -4px rgba(0,0,0,0.2), inset 0 1px 0 0 color-mix(in srgb, var(--t-heading) 4%, transparent)",
          background:
            "color-mix(in srgb, var(--t-panel) 96%, transparent)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
          <span className="text-[9.5px] font-medium text-mute uppercase tracking-[0.08em]">
            Mention a file
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
          {filtered.map((entry, i) => {
            const isActive = i === activeHighlightIdx;
            const group = GROUP_STYLES[entry.type === "folder" ? "folder" : entry.group];
            const iconPath =
              entry.type === "folder" ? FOLDER_ICON_PATH : ICON_PATHS[entry.icon];
            const secondaryLabel =
              entry.type === "folder"
                ? entry.shortLabel === entry.label
                  ? null
                  : entry.label
                : entry.shortLabel === entry.label
                  ? null
                  : entry.label;

            return (
              <button
                key={entry.type === "folder" ? `folder:${entry.path}` : entry.key}
                ref={(el) => {
                  if (el) itemRefs.current.set(i, el);
                  else itemRefs.current.delete(i);
                }}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(entry)}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`
                  w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                  transition-colors duration-100 cursor-pointer group/item
                  ${
                    isActive
                      ? "bg-accent-fill/8"
                      : "bg-transparent hover:bg-page/40"
                  }
                `}
              >
                {/* File icon */}
                <span
                  className={`
                    flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center
                    transition-colors duration-100 border
                    ${
                      isActive
                        ? "bg-accent-fill/12 border-accent/20 text-accent"
                        : "bg-page/50 border-edge/30 text-dim group-hover/item:text-sub"
                    }
                  `}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={iconPath} />
                  </svg>
                </span>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        text-[11.5px] font-medium truncate transition-colors duration-100
                        ${isActive ? "text-heading" : "text-sub"}
                      `}
                    >
                      {entry.type === "folder" ? entry.label : entry.shortLabel}
                    </span>
                    <span
                      className={`
                        flex-shrink-0 text-[8.5px] font-medium px-1.5 py-[1px] rounded-full border leading-snug
                        ${group.bg} ${group.text} border-current/15
                      `}
                    >
                      {group.label}
                    </span>
                  </div>
                  {secondaryLabel && (
                    <p className="text-[10px] text-dim mt-0.5 truncate leading-snug">
                      {secondaryLabel}
                    </p>
                  )}
                </div>

                {/* Active indicator line */}
                {isActive && (
                  <span className="flex-shrink-0 w-[3px] h-4 rounded-full bg-accent-fill/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
