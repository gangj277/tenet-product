"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { formatPaperQualitySummary } from "@/lib/discovery/paper-quality";
import type { FileEntry } from "../_lib/workspace-types";

/* ── SVG icon paths (heroicons outline, 24×24 viewBox) ── */

const ICON_PATHS: Record<FileEntry["icon"], string> = {
  overview:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
  synthesis:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  claims:
    "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  gaps:
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
  "next-steps":
    "M13 7l5 5m0 0l-5 5m5-5H6",
  "source-uploaded":
    "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
  "source-discovered":
    "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  paper:
    "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  note:
    "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  experiment:
    "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.594-7.512a12.083 12.083 0 00-3.401-5.876M5 14.5l1.594-7.512a12.083 12.083 0 013.401-5.876",
};

/* ── Badge colors ── */

const BADGE_STYLES: Record<string, string> = {
  uploaded:
    "bg-amber-500/15 text-amber-400 border-amber-500/20",
  discovered:
    "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const BADGE_LABEL: Record<string, string> = {
  uploaded: "PDF",
  discovered: "Web",
};

/* ── Collapsible section ── */

function SectionHeader({
  title,
  count,
  open,
  onToggle,
  trailing,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center w-full px-3 py-1.5">
      <button
        onClick={onToggle}
        className="flex items-center flex-1 text-[10px] font-semibold uppercase tracking-wider text-dim hover:text-sub transition-colors cursor-pointer select-none"
      >
        {/* Chevron */}
        <svg
          className={`w-3 h-3 mr-1.5 transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="flex-1 text-left">{title}</span>
        <span className="text-[9px] text-dim tabular-nums">{count}</span>
      </button>
      {trailing}
    </div>
  );
}

/* ── File row ── */

function FileRow({
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

  // depth=0 means root-level (no folder), depth=1 means inside a root folder, etc.
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
          onClick={(e) => { e.stopPropagation(); setConfirming(false); onDelete?.(file.key); }}
          className="p-0.5 rounded hover:bg-red-500/20 transition-colors cursor-pointer"
          title="Confirm delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
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

      {/* Indent guides */}
      {depth > 0 && Array.from({ length: depth }, (_, i) => (
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

      {/* Quality badge or origin badge */}
      {!renaming && (() => {
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

      {/* Trash icon on hover */}
      {onDelete && !renaming && (
        <span
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
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

/* ── Folder tree types ── */

interface FolderNode {
  name: string;
  path: string; // full slash-separated path
  files: FileEntry[];
  children: FolderNode[];
}

function buildFolderTree(
  files: FileEntry[],
  emptyFolders?: Set<string>
): { roots: FolderNode[]; ungrouped: FileEntry[] } {
  const ungrouped: FileEntry[] = [];
  const nodeMap = new Map<string, FolderNode>();

  // Helper to ensure a folder path (and all ancestors) exists in the tree
  function ensurePath(folderPath: string) {
    const segments = folderPath.split("/");
    let currentPath = "";
    for (const seg of segments) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      if (!nodeMap.has(currentPath)) {
        const node: FolderNode = { name: seg, path: currentPath, files: [], children: [] };
        nodeMap.set(currentPath, node);
        if (parentPath) {
          nodeMap.get(parentPath)!.children.push(node);
        }
      }
    }
  }

  // Pre-create user-created empty folders
  if (emptyFolders) {
    for (const fp of emptyFolders) {
      ensurePath(fp);
    }
  }

  for (const file of files) {
    if (!file.folder) {
      ungrouped.push(file);
      continue;
    }
    ensurePath(file.folder);
    nodeMap.get(file.folder)!.files.push(file);
  }

  // Collect root-level folders (no "/" in path)
  const roots: FolderNode[] = [];
  for (const [path, node] of nodeMap) {
    if (!path.includes("/")) {
      roots.push(node);
    }
  }

  return { roots, ungrouped };
}

/* ── Recursive nested folder group ── */

function NestedFolderGroup({
  node,
  depth,
  activeFileKey,
  onSelect,
  onDelete,
  onRename,
  onCreateNote,
  onCreateFolder,
  onDeleteFolder,
  onDragStart,
  onDrop,
  dragOverFolder,
  onDragOverFolder,
}: {
  node: FolderNode;
  depth: number;
  activeFileKey: string;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
  onRename?: (key: string, newLabel: string) => void;
  onCreateNote?: (label: string, folder?: string) => string;
  onCreateFolder?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  onDragStart?: (e: React.DragEvent, key: string) => void;
  onDrop?: (folderPath: string | null) => void;
  dragOverFolder: string | null;
  onDragOverFolder: (path: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [creatingInside, setCreatingInside] = useState<"note" | "folder" | false>(false);
  const isDropTarget = dragOverFolder === node.path;

  return (
    <div>
      {/* Folder header row */}
      <div
        className={`relative flex items-center w-full py-1 text-[10px] font-medium text-dim hover:text-sub transition-colors select-none group/folder ${
          isDropTarget ? "bg-accent-fill/12 text-accent" : ""
        }`}
        style={{ paddingLeft: `${20 + depth * 14}px`, paddingRight: "8px" }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOverFolder(node.path);
        }}
        onDragLeave={() => onDragOverFolder(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOverFolder(null);
          onDrop?.(node.path);
        }}
      >
        {/* Indent guides */}
        {depth > 0 && Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-edge/20"
            style={{ left: `${20 + (i + 1) * 14 - 4}px` }}
          />
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center flex-1 min-w-0 cursor-pointer"
        >
          <svg
            className={`w-2.5 h-2.5 mr-1.5 flex-shrink-0 transition-transform duration-150 ${
              open ? "rotate-0" : "-rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {/* Folder icon */}
          <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="flex-1 text-left truncate">{node.name}</span>
          <span className="text-[9px] text-dim tabular-nums ml-1">
            {countFilesInNode(node)}
          </span>
        </button>
        {/* Folder actions — visible on hover */}
        {confirmingDelete ? (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <span className="text-[9px] text-red-400 mr-0.5">Delete?</span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); onDeleteFolder?.(node.path); }}
              className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
              title="Confirm delete"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
              className="p-0.5 rounded hover:bg-surface/60 text-dim transition-colors cursor-pointer"
              title="Cancel"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0 opacity-0 group-hover/folder:opacity-100 transition-opacity flex-shrink-0 ml-1">
            {onCreateNote && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                  setCreatingInside("note");
                }}
                className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                title={`New note in ${node.name}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </button>
            )}
            {onCreateFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                  setCreatingInside("folder");
                }}
                className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                title={`New folder in ${node.name}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
                className="p-0.5 rounded hover:bg-red-500/20 text-dim hover:text-red-400 transition-all cursor-pointer"
                title={`Delete ${node.name}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {/* Inline create inside this folder */}
          {creatingInside === "note" && (
            <div style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <InlineCreateInput
                icon="note"
                placeholder="Note name..."
                onSubmit={(label) => {
                  onCreateNote?.(label, node.path);
                  setCreatingInside(false);
                }}
                onCancel={() => setCreatingInside(false)}
              />
            </div>
          )}
          {creatingInside === "folder" && (
            <div style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <InlineCreateInput
                icon="folder"
                placeholder="Folder name..."
                onSubmit={(name) => {
                  onCreateFolder?.(`${node.path}/${name}`);
                  setCreatingInside(false);
                }}
                onCancel={() => setCreatingInside(false)}
              />
            </div>
          )}
          {node.files.map((file) => (
            <FileRow
              key={file.key}
              file={file}
              active={file.key === activeFileKey}
              onClick={() => onSelect(file.key)}
              onDelete={onDelete}
              onRename={onRename}
              depth={depth + 1}
              draggable={file.group === "note"}
              onDragStart={onDragStart}
            />
          ))}
          {node.children.map((child) => (
            <NestedFolderGroup
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFileKey={activeFileKey}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onDragStart={onDragStart}
              onDrop={onDrop}
              dragOverFolder={dragOverFolder}
              onDragOverFolder={onDragOverFolder}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function countFilesInNode(node: FolderNode): number {
  let count = node.files.length;
  for (const child of node.children) count += countFilesInNode(child);
  return count;
}

/* ── Folder group for sources (flat, unchanged from original) ── */

function FolderGroup({
  folderName,
  files,
  activeFileKey,
  onSelect,
  onDelete,
}: {
  folderName: string;
  files: FileEntry[];
  activeFileKey: string;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center w-full px-5 py-1 text-[10px] font-medium text-dim hover:text-sub transition-colors cursor-pointer select-none"
      >
        <svg
          className={`w-2.5 h-2.5 mr-1.5 transition-transform duration-150 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="flex-1 text-left truncate">{folderName}</span>
        <span className="text-[9px] text-dim tabular-nums ml-1">{files.length}</span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden pl-2">
          {files.map((file) => (
            <FileRow
              key={file.key}
              file={file}
              active={file.key === activeFileKey}
              onClick={() => onSelect(file.key)}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Inline create input ── */

function InlineCreateInput({
  onSubmit,
  onCancel,
  icon,
  placeholder,
}: {
  onSubmit: (label: string) => void;
  onCancel: () => void;
  icon: "note" | "folder" | "experiment";
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const iconPath =
    icon === "folder"
      ? "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      : icon === "experiment"
        ? ICON_PATHS.experiment
        : ICON_PATHS.note;

  return (
    <div className="flex items-center gap-2 px-5 py-[5px]">
      <svg className="w-[14px] h-[14px] flex-shrink-0 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          const trimmed = value.trim();
          if (trimmed) onSubmit(trimmed);
          else onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-b border-accent-fill/40 text-[12px] text-heading outline-none placeholder:text-dim/50 px-0 py-0"
      />
    </div>
  );
}

/* ── Main component ── */

export function FileSidebar({
  files,
  activeFileKey,
  onSelect,
  onDelete,
  onCreateNote,
  onMoveNote,
  onRenameNote,
  onAddSource,
  onCreateExperiment,
}: {
  files: FileEntry[];
  activeFileKey: string;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
  onCreateNote?: (label: string, folder?: string) => string;
  onMoveNote?: (noteKey: string, newFolder: string | null) => void;
  onRenameNote?: (noteKey: string, newLabel: string) => void;
  onAddSource?: (input: { file?: File; url?: string }) => Promise<void>;
  onCreateExperiment?: (title: string) => string;
}) {
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [papersOpen, setPapersOpen] = useState(false);
  const [experimentsOpen, setExperimentsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingExperiment, setCreatingExperiment] = useState(false);

  // Add source state
  const [addingSource, setAddingSource] = useState(false);
  const [addSourceUrl, setAddSourceUrl] = useState("");
  const [addSourceLoading, setAddSourceLoading] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Pinned folders — persist even when empty, only removed by explicit delete
  const [pinnedFolders, setPinnedFolders] = useState<Set<string>>(new Set());

  // Drag-and-drop state
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const coreFiles = files.filter((f) => f.group === "core");
  const noteFiles = files.filter((f) => f.group === "note");
  const paperFiles = files.filter((f) => f.group === "paper");
  const experimentFiles = files.filter((f) => f.group === "experiment");
  const sourceFiles = files.filter((f) => f.group === "source");

  // Auto-pin folders that contain notes so they persist when notes are moved out
  useEffect(() => {
    const noteFolderPaths = noteFiles
      .map((f) => f.folder)
      .filter((f): f is string => !!f);
    if (noteFolderPaths.length > 0) {
      setPinnedFolders((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const fp of noteFolderPaths) {
          // Pin this folder and all ancestor folders
          const segments = fp.split("/");
          let path = "";
          for (const seg of segments) {
            path = path ? `${path}/${seg}` : seg;
            if (!next.has(path)) {
              next.add(path);
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }
  }, [noteFiles]);

  const { roots: noteFolders, ungrouped: ungroupedNotes } = buildFolderTree(noteFiles, pinnedFolders);

  // Delete folder: unpin it + all children, move contained notes to parent
  const handleDeleteFolder = useCallback(
    (folderPath: string) => {
      // Find parent folder (null if root)
      const lastSlash = folderPath.lastIndexOf("/");
      const parentFolder = lastSlash > 0 ? folderPath.slice(0, lastSlash) : null;

      // Move all notes in this folder (and subfolders) to parent
      for (const file of noteFiles) {
        if (file.folder === folderPath || file.folder?.startsWith(folderPath + "/")) {
          onMoveNote?.(file.key, parentFolder);
        }
      }

      // Unpin this folder and all sub-folders
      setPinnedFolders((prev) => {
        const next = new Set(prev);
        for (const path of prev) {
          if (path === folderPath || path.startsWith(folderPath + "/")) {
            next.delete(path);
          }
        }
        return next;
      });
    },
    [noteFiles, onMoveNote]
  );

  const handleDragStart = useCallback((e: React.DragEvent, key: string) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);

  const handleDrop = useCallback(
    (folderPath: string | null) => {
      if (dragKey && onMoveNote) {
        onMoveNote(dragKey, folderPath);
      }
      setDragKey(null);
      setDragOverFolder(null);
      setDragOverRoot(false);
    },
    [dragKey, onMoveNote]
  );

  const handleAddSourceFile = useCallback(
    async (file: File) => {
      if (!onAddSource) return;
      setAddSourceLoading(true);
      setAddSourceError(null);
      try {
        await onAddSource({ file });
        setAddingSource(false);
      } catch (err) {
        setAddSourceError((err as Error).message || "Failed to add source");
      } finally {
        setAddSourceLoading(false);
      }
    },
    [onAddSource]
  );

  const handleAddSourceUrl = useCallback(
    async (url: string) => {
      if (!onAddSource || !url.trim()) return;
      setAddSourceLoading(true);
      setAddSourceError(null);
      try {
        await onAddSource({ url: url.trim() });
        setAddingSource(false);
        setAddSourceUrl("");
      } catch (err) {
        setAddSourceError((err as Error).message || "Failed to add source");
      } finally {
        setAddSourceLoading(false);
      }
    },
    [onAddSource]
  );

  const totalArtifactCount = coreFiles.length + noteFiles.length;

  return (
    <div className="flex flex-col h-full select-none">
      {/* Explorer header */}
      <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-dim">
        Explorer
      </div>

      {/* Artifacts section (core files + notes) */}
      {(coreFiles.length > 0 || noteFiles.length > 0) && (
        <div>
          <SectionHeader
            title="Artifacts"
            count={totalArtifactCount}
            open={artifactsOpen}
            onToggle={() => setArtifactsOpen((v) => !v)}
            trailing={
              onCreateNote ? (
                <div className="flex items-center gap-0.5">
                  {/* New note button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setArtifactsOpen(true);
                      setCreatingNote(true);
                      setCreatingFolder(false);
                    }}
                    className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                    title="New note"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </button>
                  {/* New folder button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setArtifactsOpen(true);
                      setCreatingFolder(true);
                      setCreatingNote(false);
                    }}
                    className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                    title="New folder"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </button>
                </div>
              ) : undefined
            }
          />
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{
              gridTemplateRows: artifactsOpen ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              {/* Core files */}
              {coreFiles.map((file) => (
                <FileRow
                  key={file.key}
                  file={file}
                  active={file.key === activeFileKey}
                  onClick={() => onSelect(file.key)}
                />
              ))}

              {/* Inline create note */}
              {creatingNote && (
                <InlineCreateInput
                  icon="note"
                  placeholder="Note name..."
                  onSubmit={(label) => {
                    onCreateNote?.(label);
                    setCreatingNote(false);
                  }}
                  onCancel={() => setCreatingNote(false)}
                />
              )}

              {/* Inline create folder */}
              {creatingFolder && (
                <InlineCreateInput
                  icon="folder"
                  placeholder="Folder name..."
                  onSubmit={(name) => {
                    setPinnedFolders((prev) => new Set(prev).add(name));
                    setCreatingFolder(false);
                  }}
                  onCancel={() => setCreatingFolder(false)}
                />
              )}

              {/* Notes: ungrouped */}
              <div
                onDragOver={(e) => {
                  if (!dragKey) return;
                  e.preventDefault();
                  setDragOverRoot(true);
                  setDragOverFolder(null);
                }}
                onDragLeave={() => setDragOverRoot(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverRoot(false);
                  handleDrop(null);
                }}
                className={dragOverRoot && dragKey ? "bg-accent-fill/8" : ""}
              >
                {ungroupedNotes.map((file) => (
                  <FileRow
                    key={file.key}
                    file={file}
                    active={file.key === activeFileKey}
                    onClick={() => onSelect(file.key)}
                    onDelete={onDelete}
                    onRename={onRenameNote}
                    draggable
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>

              {/* Notes: folders */}
              {noteFolders.map((node) => (
                <NestedFolderGroup
                  key={node.path}
                  node={node}
                  depth={0}
                  activeFileKey={activeFileKey}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onRename={onRenameNote}
                  onCreateNote={onCreateNote}
                  onCreateFolder={(path) => setPinnedFolders((prev) => new Set(prev).add(path))}
                  onDeleteFolder={handleDeleteFolder}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  dragOverFolder={dragOverFolder}
                  onDragOverFolder={setDragOverFolder}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Papers section */}
      {paperFiles.length > 0 && (
        <div className="mt-1">
          <SectionHeader
            title="Papers"
            count={paperFiles.length}
            open={papersOpen}
            onToggle={() => setPapersOpen((v) => !v)}
          />
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{
              gridTemplateRows: papersOpen ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              {paperFiles.map((file) => (
                <FileRow
                  key={file.key}
                  file={file}
                  active={file.key === activeFileKey}
                  onClick={() => onSelect(file.key)}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Experiments section */}
      <div className="mt-1">
        <SectionHeader
          title="Experiments"
          count={experimentFiles.length}
          open={experimentsOpen}
          onToggle={() => setExperimentsOpen((v) => !v)}
          trailing={
            onCreateExperiment ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExperimentsOpen(true);
                  setCreatingExperiment(true);
                }}
                className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                title="New experiment"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : undefined
          }
        />
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{
            gridTemplateRows: experimentsOpen ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            {creatingExperiment && (
              <InlineCreateInput
                icon="experiment"
                placeholder="Experiment name..."
                onSubmit={(label) => {
                  onCreateExperiment?.(label);
                  setCreatingExperiment(false);
                }}
                onCancel={() => setCreatingExperiment(false)}
              />
            )}
            {experimentFiles.map((file) => (
              <FileRow
                key={file.key}
                file={file}
                active={file.key === activeFileKey}
                onClick={() => onSelect(file.key)}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sources section */}
      {(sourceFiles.length > 0 || onAddSource) && (
        <div className="mt-1">
          <SectionHeader
            title="Sources"
            count={sourceFiles.length}
            open={sourcesOpen}
            onToggle={() => setSourcesOpen((v) => !v)}
            trailing={onAddSource ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSourcesOpen(true);
                  setAddingSource((v) => !v);
                  setAddSourceError(null);
                  setAddSourceUrl("");
                }}
                className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                title="Add source"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : undefined}
          />
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{
              gridTemplateRows: sourcesOpen ? "1fr" : "0fr",
            }}
          >
            <div className="overflow-hidden">
              {/* Add source inline panel */}
              {addingSource && (
                <div className="mx-3 my-1.5 p-2 rounded-md bg-surface/60 border border-edge/30 space-y-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddSourceFile(file);
                      e.target.value = "";
                    }}
                  />
                  {/* Upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={addSourceLoading}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-sub hover:text-heading hover:bg-page/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Upload PDF</span>
                  </button>
                  {/* Divider */}
                  <div className="flex items-center gap-2 px-2">
                    <div className="flex-1 h-px bg-edge/20" />
                    <span className="text-[9px] text-dim">or</span>
                    <div className="flex-1 h-px bg-edge/20" />
                  </div>
                  {/* URL input */}
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={urlInputRef}
                      value={addSourceUrl}
                      onChange={(e) => setAddSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && addSourceUrl.trim()) {
                          handleAddSourceUrl(addSourceUrl);
                        }
                        if (e.key === "Escape") {
                          setAddingSource(false);
                          setAddSourceUrl("");
                          setAddSourceError(null);
                        }
                      }}
                      placeholder="Paste PDF URL..."
                      disabled={addSourceLoading}
                      className="flex-1 bg-transparent border-b border-edge/30 focus:border-accent-fill/40 text-[11px] text-heading outline-none placeholder:text-dim/50 px-1 py-1 transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleAddSourceUrl(addSourceUrl)}
                      disabled={addSourceLoading || !addSourceUrl.trim()}
                      className="px-2 py-1 rounded text-[10px] font-medium text-accent hover:bg-accent-fill/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {/* Loading indicator */}
                  {addSourceLoading && (
                    <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-dim">
                      <div className="w-3 h-3 border-[1.5px] border-dim/30 border-t-accent-fill rounded-full animate-spin" />
                      <span>Processing PDF...</span>
                    </div>
                  )}
                  {/* Error */}
                  {addSourceError && (
                    <div className="px-2 py-1 text-[10px] text-red-400 leading-snug">
                      {addSourceError}
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const hasFolders = sourceFiles.some((f) => f.folder);
                if (!hasFolders) {
                  return sourceFiles.map((file) => (
                    <FileRow
                      key={file.key}
                      file={file}
                      active={file.key === activeFileKey}
                      onClick={() => onSelect(file.key)}
                      onDelete={onDelete}
                    />
                  ));
                }

                const folderMap = new Map<string, FileEntry[]>();
                const ungrouped: FileEntry[] = [];
                for (const file of sourceFiles) {
                  if (file.folder) {
                    const arr = folderMap.get(file.folder) ?? [];
                    arr.push(file);
                    folderMap.set(file.folder, arr);
                  } else {
                    ungrouped.push(file);
                  }
                }

                return (
                  <>
                    {Array.from(folderMap.entries()).map(([folderName, folderFiles]) => (
                      <FolderGroup
                        key={folderName}
                        folderName={folderName}
                        files={folderFiles}
                        activeFileKey={activeFileKey}
                        onSelect={onSelect}
                        onDelete={onDelete}
                      />
                    ))}
                    {ungrouped.map((file) => (
                      <FileRow
                        key={file.key}
                        file={file}
                        active={file.key === activeFileKey}
                        onClick={() => onSelect(file.key)}
                        onDelete={onDelete}
                      />
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
