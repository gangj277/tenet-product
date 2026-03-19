"use client";

import { useState } from "react";
import type { ProposedUpdate } from "../../../_lib/workspace-types";
import { DiffContent } from "./diff-content";

export function ProposedUpdateCard({
  update,
  onAccept,
  onReject,
  currentContent,
}: {
  update: ProposedUpdate;
  onAccept: () => void;
  onReject: () => void;
  currentContent?: string;
}) {
  const isPending = update.status === "pending";
  const [showDiff, setShowDiff] = useState(false);
  const canShowDiff = update.type === "edit" && currentContent !== undefined;

  return (
    <div className="mt-2.5 rounded-lg border border-edge/40 bg-page/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                update.type === "edit"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {update.type === "edit" ? "Edit" : "New"}
            </span>
            {update.key.startsWith("paper:") && (
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-violet-500/10 text-violet-400">
                Paper
              </span>
            )}
            {update.label && (
              <span className="text-[11px] text-dim truncate">{update.label}</span>
            )}
          </div>
          <p className="text-[12px] text-sub leading-relaxed">{update.summary}</p>
          {canShowDiff && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className="mt-1.5 text-[10px] text-dim hover:text-sub transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showDiff ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {showDiff ? "Hide changes" : "Show changes"}
            </button>
          )}
        </div>
        {isPending ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onAccept}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-md text-dim hover:bg-page hover:text-sub transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm flex-shrink-0 ${
              update.status === "accepted"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {update.status === "accepted" ? "Applied" : "Dismissed"}
          </span>
        )}
      </div>
      {canShowDiff && showDiff && (
        <div className="mt-2.5">
          <DiffContent
            oldContent={currentContent!}
            newContent={update.content}
            isExperiment={update.key.startsWith("experiment:")}
          />
        </div>
      )}
    </div>
  );
}
