"use client";

import { useEffect, useRef, useState } from "react";
import { formatPaperQualitySummary } from "@/lib/discovery/paper-quality";
import type { FileEntry } from "../../_lib/workspace-types";
import { BADGE_LABEL, BADGE_STYLES } from "./sidebar-badges";
import { ICON_PATHS } from "./sidebar-icons";

export function FileRow({
  file,
  active,
  onClick,
  onDelete,
  onRename,
  depth = 0,
  draggable: isDraggable,
  onDragStart,
}: {
  file: FileEntry;
  active: boolean;
  onClick: () => void;
  onDelete?: (key: string) => void;
  onRename?: (key: string, newLabel: string) => void;
  depth?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, key: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(file.label);
  const renameRef = useRef<HTMLInputElement>(null);
  const originBadge = file.origin ? BADGE_LABEL[file.origin] : null;
  const badgeClass = file.origin ? BADGE_STYLES[file.origin] : "";
  const leftPad = 20 + depth * 14;

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  if (confirming) {
    return (
      <div
        className="relative flex items-center gap-1.5 w-full pr-2 py-[5px] text-[12px] text-red-400 bg-red-500/8"
        style={{ paddingLeft: `${leftPad}px` }}
      >
        <span className="flex-1 truncate text-[11px]">Delete?</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
            onDelete?.(file.key);
          }}
          className="p-0.5 rounded hover:bg-red-500/20 transition-colors cursor-pointer"
          title="Confirm delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="p-0.5 rounded hover:bg-surface/60 transition-colors cursor-pointer"
          title="Cancel"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      onDoubleClick={(e) => {
        if (onRename && file.group === "note") {
          e.preventDefault();
          setRenameValue(file.label);
          setRenaming(true);
        }
      }}
      title={file.label}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart?.(e, file.key)}
      className={`
        relative flex items-center gap-2 w-full pr-2 py-[5px] text-left text-[12px] transition-colors cursor-pointer group
        ${active ? "bg-accent-fill/8 text-accent" : "text-sub hover:text-heading hover:bg-page/60"}
        ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""}
      `}
      style={{ paddingLeft: `${leftPad}px` }}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent-fill rounded-r-full" />
      )}

      {depth > 0 &&
        Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-edge/20"
            style={{ left: `${20 + (i + 1) * 14 - 4}px` }}
          />
        ))}

      {file.isLoading ? (
        <div className="w-[14px] h-[14px] flex-shrink-0 border-[1.5px] border-dim/40 border-t-accent-fill rounded-full animate-spin" />
      ) : (
        <svg
          className="w-[14px] h-[14px] flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ICON_PATHS[file.icon]} />
        </svg>
      )}

      {renaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const trimmed = renameValue.trim();
              if (trimmed && trimmed !== file.label) onRename?.(file.key, trimmed);
              setRenaming(false);
            }
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={() => {
            const trimmed = renameValue.trim();
            if (trimmed && trimmed !== file.label) onRename?.(file.key, trimmed);
            setRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border-b border-accent-fill/40 text-[12px] text-heading outline-none px-0 py-0"
        />
      ) : (
        <span className="flex-1 truncate">{file.shortLabel}</span>
      )}

      {!renaming &&
        (() => {
          const citations = file.paperQuality?.metrics?.citationCount;
          const isPreprint = file.paperQuality?.flags?.preprint;
          const qualityTooltip = formatPaperQualitySummary(file.paperQuality);
          const hideOnHover = onDelete ? "group-hover:hidden" : "";

          if (typeof citations === "number" && citations > 0) {
            const color =
              citations >= 100
                ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                : citations >= 10
                  ? "bg-sky-500/12 text-sky-400 border-sky-500/20"
                  : "bg-surface/60 text-dim border-edge/30";

            return (
              <span
                className={`flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border leading-none tabular-nums ${color} ${hideOnHover}`}
                title={qualityTooltip}
              >
                {citations >= 1000 ? `${(citations / 1000).toFixed(1)}k` : citations}
              </span>
            );
          }

          if (isPreprint) {
            return (
              <span
                className={`flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border leading-none bg-surface/60 text-dim border-edge/30 ${hideOnHover}`}
                title={qualityTooltip || "Preprint"}
              >
                Pre
              </span>
            );
          }

          if (originBadge) {
            return (
              <span
                className={`flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border leading-none ${badgeClass} ${hideOnHover}`}
              >
                {originBadge}
              </span>
            );
          }

          return null;
        })()}

      {onDelete && !renaming && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-dim hover:text-red-400 transition-all cursor-pointer"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </span>
      )}
    </button>
  );
}
