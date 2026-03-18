"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionSummary } from "../_lib/workspace-types";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);

  if (d >= todayStart) return "Today";
  if (d >= yesterdayStart) return "Yesterday";
  if (d >= weekStart) return "This Week";
  return "Older";
}

export function SessionHistory({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the rename input when editingId changes
  useEffect(() => {
    if (editingId) {
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      });
    }
  }, [editingId]);

  function startRename(s: SessionSummary) {
    setEditingId(s.id);
    setEditDraft(s.title || "Untitled session");
  }

  function commitRename() {
    if (!editingId) return;
    const trimmed = editDraft.trim();
    if (trimmed) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelRename() {
    setEditingId(null);
  }

  // Group sessions by date
  const groups = new Map<string, SessionSummary[]>();
  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  for (const s of sessions) {
    const group = getDateGroup(s.updatedAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(s);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/30 flex-shrink-0">
        <span className="font-sans text-[12px] font-semibold text-heading">
          Chat History
        </span>
        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium text-accent hover:text-accent-hover bg-accent-fill/8 hover:bg-accent-fill/14 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-[11.5px] text-dim">No chat sessions yet.</p>
            <p className="text-[10.5px] text-mute mt-1">
              Send a message to start a conversation.
            </p>
          </div>
        )}

        {groupOrder.map((groupName) => {
          const items = groups.get(groupName);
          if (!items || items.length === 0) return null;
          return (
            <div key={groupName}>
              <p className="text-[10px] font-medium text-dim uppercase tracking-wider mb-1.5 px-1">
                {groupName}
              </p>
              <div className="space-y-1">
                {items.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const isConfirmDelete = confirmDeleteId === s.id;
                  const isEditing = editingId === s.id;
                  const displayTitle = s.title || "Untitled session";

                  return (
                    <div
                      key={s.id}
                      className={`group relative rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        isActive
                          ? "bg-accent-fill/8 border-l-2 border-accent"
                          : "hover:bg-page/60 border-l-2 border-transparent"
                      }`}
                      onClick={() => {
                        if (!isEditing) onSelect(s.id);
                      }}
                    >
                      {/* Title — editable or static */}
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename();
                            }
                            if (e.key === "Escape") cancelRename();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11.5px] text-heading font-medium w-full bg-transparent outline-none border-b border-accent/40 pr-12"
                          maxLength={500}
                        />
                      ) : (
                        <p
                          className="text-[11.5px] text-heading font-medium truncate pr-12"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startRename(s);
                          }}
                          title="Double-click to rename"
                        >
                          {displayTitle}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-dim">
                          {formatRelativeTime(s.updatedAt)}
                        </span>
                        {s.messageCount > 0 && (
                          <span className="text-[9.5px] text-mute">
                            {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      {isConfirmDelete ? (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(s.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 text-[9.5px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 rounded transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 text-[9.5px] text-dim hover:text-sub rounded transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : !isEditing ? (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          {/* Rename button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-dim hover:text-sub hover:bg-page transition-all cursor-pointer"
                            title="Rename session"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                            </svg>
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(s.id);
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-dim hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Delete session"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
