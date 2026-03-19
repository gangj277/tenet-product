"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SourceRef, LineRange } from "../../../../_lib/citation-utils";
import type {
  FileEntry,
  PendingUpdateContext,
} from "../../../_lib/workspace-types";
import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import { DiffActionBar, ExperimentDiffView } from "../../diff";
import { ExperimentDisplay } from "./experiment-display";
import {
  cloneExperimentDesign,
  parseExperimentDesignContent,
} from "./experiment-utils";

export function ExperimentViewer({
  activeFile,
  content,
  sourceFiles,
  onNavigateSource,
  onUpdate,
  saveStatus = "idle",
  onSave,
  pendingUpdate,
  onAcceptUpdate,
  onRejectUpdate,
}: {
  activeFile: FileEntry;
  content: string;
  sourceFiles?: SourceRef[];
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
  onUpdate?: (md: string) => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
  pendingUpdate?: PendingUpdateContext | null;
  onAcceptUpdate?: (messageId: string, updateId: string) => void;
  onRejectUpdate?: (messageId: string, updateId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ExperimentDesign | null>(null);

  const design = useMemo(() => parseExperimentDesignContent(content), [content]);

  const pendingNewDesign = useMemo(
    () =>
      pendingUpdate
        ? parseExperimentDesignContent(pendingUpdate.update.content)
        : null,
    [pendingUpdate]
  );

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  const enterEdit = useCallback(() => {
    if (!design) return;
    setDraft(cloneExperimentDesign(design));
    setEditing(true);
  }, [design]);

  const exitEdit = useCallback(() => {
    setEditing(false);
    setDraft(null);
  }, []);

  const pendingUpdateRef = useRef(false);

  const updateDraft = useCallback(
    (updater: (d: ExperimentDesign) => ExperimentDesign) => {
      pendingUpdateRef.current = true;
      setDraft((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
    },
    []
  );

  useEffect(() => {
    if (pendingUpdateRef.current && draft) {
      pendingUpdateRef.current = false;
      onUpdate?.(JSON.stringify(draft));
    }
  }, [draft, onUpdate]);

  if (!design) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] text-dim">Unable to parse experiment design</p>
      </div>
    );
  }

  // In edit mode, render from draft; in view mode, render from parsed content
  const d = editing && draft ? draft : design;

  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-edge/30 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-accent-fill/10 flex-shrink-0">
            <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <span className="font-mono text-[12px] text-sub truncate" title={activeFile.label}>
            {activeFile.label}
          </span>
          {pendingUpdate && (
            <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Pending changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save status */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-dim">
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
              Saving
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-dim">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[11px] font-medium text-red-500">Save failed</span>
          )}
          {editing && onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub disabled:opacity-40 disabled:cursor-default"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save
            </button>
          )}
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub flex-shrink-0"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={editing ? exitEdit : enterEdit}
            disabled={!!pendingUpdate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub disabled:opacity-40 disabled:cursor-default"
          >
            {editing ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {pendingUpdate && design && pendingNewDesign ? (
        <div className="flex-1 overflow-y-auto relative">
          <div className="max-w-[740px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
            <ExperimentDiffView oldDesign={design} newDesign={pendingNewDesign} />
          </div>
          <DiffActionBar
            summary={pendingUpdate.update.summary}
            onAccept={() => onAcceptUpdate?.(pendingUpdate.messageId, pendingUpdate.update.id)}
            onReject={() => onRejectUpdate?.(pendingUpdate.messageId, pendingUpdate.update.id)}
          />
        </div>
      ) : (
        <ExperimentDisplay
          design={d}
          editing={editing}
          updateDraft={updateDraft}
          sourceFiles={sourceFiles}
          onNavigateSource={onNavigateSource}
        />
      )}
    </div>
  );
}
