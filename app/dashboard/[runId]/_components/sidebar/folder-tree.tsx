"use client";

import { useState } from "react";
import type { FileEntry } from "../../_lib/workspace-types";
import { FolderNode, countFilesInNode } from "./tree-utils";
import { FileRow } from "./file-row";
import { InlineCreateInput } from "./inline-create-input";
import { FOLDER_ICON_PATH } from "./sidebar-icons";

export function NestedFolderGroup({
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
        {depth > 0 &&
          Array.from({ length: depth }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 bottom-0 w-px bg-edge/20"
              style={{ left: `${20 + (i + 1) * 14 - 4}px` }}
            />
          ))}
        <button onClick={() => setOpen((v) => !v)} className="flex items-center flex-1 min-w-0 cursor-pointer">
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
          <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={FOLDER_ICON_PATH} />
          </svg>
          <span className="flex-1 text-left truncate">{node.name}</span>
          <span className="text-[9px] text-dim tabular-nums ml-1">{countFilesInNode(node)}</span>
        </button>
        {confirmingDelete ? (
          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <span className="text-[9px] text-red-400 mr-0.5">Delete?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
                onDeleteFolder?.(node.path);
              }}
              className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
              title="Confirm delete"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
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
      <div className="grid transition-[grid-template-rows] duration-150 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
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

export function FolderGroup({
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
      <div className="grid transition-[grid-template-rows] duration-150 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
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
