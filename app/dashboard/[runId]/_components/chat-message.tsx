"use client";

import { useState } from "react";
import type { ChatAttachmentInfo, ChatMessage, ProposedUpdate } from "../_lib/workspace-types";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { LineRange, SourceRef } from "../../_lib/citation-utils";
import { ChatMarkdown } from "./chat-markdown";

const SEARCH_RESULTS_PREVIEW = 5;

/* ── Activity Indicator (contextual thinking state) ── */

function ActivityIndicator({ label }: { label?: string }) {
  return (
    <div className="space-y-2.5 py-0.5">
      {/* Label row with spinner */}
      <div className="flex items-center gap-2">
        <svg
          className="activity-spinner w-3.5 h-3.5 text-dot"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            d="M12 2a10 10 0 019.95 9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[11.5px] text-sub">
          {label || "Thinking"}
          <span className="chat-dot inline-block ml-0.5">.</span>
          <span className="chat-dot inline-block">.</span>
          <span className="chat-dot inline-block">.</span>
        </span>
      </div>

      {/* Shimmer progress bar */}
      <div className="activity-bar h-[2px] w-full rounded-full bg-dot/10">
        <div className="h-full w-1/3 rounded-full bg-dot/40" />
      </div>
    </div>
  );
}

/* ── Proposed Update Card ── */

function ProposedUpdateCard({
  update,
  onAccept,
  onReject,
}: {
  update: ProposedUpdate;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isPending = update.status === "pending";

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
              <span className="text-[11px] text-dim truncate">
                {update.label}
              </span>
            )}
          </div>
          <p className="text-[12px] text-sub leading-relaxed">
            {update.summary}
          </p>
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
    </div>
  );
}

/* ── Search Result Card ── */

const LABEL_COLORS: Record<string, string> = {
  "Highly cited": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Influential": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "Cross-indexed": "bg-sky-500/12 text-sky-400 border-sky-500/20",
  "Open access": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Preprint": "bg-surface/60 text-dim border-edge/30",
};

function formatCitations(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SearchResultCard({ source }: { source: DiscoveredSource }) {
  const year = source.publishedDate?.slice(0, 4);
  const citations = source.citationCount ?? source.paperQuality?.metrics?.citationCount;
  const labels = source.paperQuality?.hints?.labels ?? [];
  const venue = source.venue ?? source.paperQuality?.publication?.venue;

  const metaParts = [venue, year, source.author].filter(Boolean);

  const citationColor =
    typeof citations === "number" && citations >= 100
      ? "text-amber-400"
      : typeof citations === "number" && citations >= 10
        ? "text-sky-400"
        : "text-dim";

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 rounded-md border border-edge/30 bg-page/30 px-3 py-2 hover:bg-page/60 hover:border-edge/50 transition-colors"
    >
      {/* Icon */}
      <svg
        className="w-3.5 h-3.5 text-dim group-hover:text-sub flex-shrink-0 mt-0.5 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
        />
      </svg>

      <div className="flex-1 min-w-0">
        {/* Title row + citation count */}
        <div className="flex items-baseline gap-2">
          <p className="flex-1 min-w-0 text-[11.5px] text-heading font-medium leading-snug line-clamp-1 group-hover:text-accent transition-colors">
            {source.title}
          </p>
          {typeof citations === "number" && citations > 0 && (
            <span className={`flex-shrink-0 text-[9px] font-semibold tabular-nums ${citationColor}`}>
              {formatCitations(citations)}
            </span>
          )}
        </div>

        {/* Meta row: venue · year · author + quality labels */}
        {(metaParts.length > 0 || labels.length > 0) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {metaParts.length > 0 && (
              <span className="text-[10px] text-dim truncate max-w-[60%]">
                {metaParts.join(" · ")}
              </span>
            )}
            {labels.map((label) => (
              <span
                key={label}
                className={`text-[8px] font-medium px-1 py-px rounded border leading-none ${LABEL_COLORS[label] ?? "bg-surface/60 text-dim border-edge/30"}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

/* ── Search Results List (expandable) ── */

function SearchResultsList({ results }: { results: DiscoveredSource[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = results.length > SEARCH_RESULTS_PREVIEW;
  const visible = expanded ? results : results.slice(0, SEARCH_RESULTS_PREVIEW);
  const hiddenCount = results.length - SEARCH_RESULTS_PREVIEW;

  return (
    <div className="mt-3 pt-2.5 border-t border-edge/20">
      <div className="flex items-center gap-1.5 mb-2">
        <svg
          className="w-3 h-3 text-dim"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        <span className="text-[10px] font-semibold text-dim uppercase tracking-wider">
          Sources Found
        </span>
        <span className="text-[9px] text-mute">
          {results.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((source, i) => (
          <SearchResultCard key={`${source.url}-${i}`} source={source} />
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-dim hover:text-sub pl-1 cursor-pointer transition-colors"
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── User Message ── */

function UserBubble({ text, attachments }: { text: string; attachments?: ChatAttachmentInfo[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-accent-fill/8 rounded-2xl rounded-br-sm px-4 py-2.5">
        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((att, i) =>
              att.type === "image" && att.previewUrl ? (
                <img
                  key={i}
                  src={att.previewUrl}
                  alt={att.name}
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-edge/20"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-page/40 border border-edge/30"
                >
                  <svg className="w-3.5 h-3.5 text-dim flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-[10.5px] text-sub truncate max-w-[140px]">{att.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {text && (
          <p className="text-[12.5px] leading-[1.65] text-heading whitespace-pre-wrap">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Agent Message ── */

function AgentBubble({
  message,
  onAcceptUpdate,
  onRejectUpdate,
  sourceFiles,
  onSourceClick,
}: {
  message: ChatMessage;
  onAcceptUpdate?: (updateId: string) => void;
  onRejectUpdate?: (updateId: string) => void;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
}) {
  const hasUpdates = message.proposedUpdates && message.proposedUpdates.length > 0;
  const hasSearchResults = message.searchResults && message.searchResults.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        {/* Agent identity */}
        <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
          <span className="w-[5px] h-[5px] rounded-full bg-dot" />
          <span className="text-[10px] font-medium text-dim uppercase tracking-[0.06em]">
            Research Assistant
          </span>
        </div>

        {/* Content area */}
        <div className="glass-panel rounded-2xl rounded-tl-sm px-4 py-3">
          {/* Markdown-rendered text */}
          {message.text && (
            <div>
              <ChatMarkdown content={message.text} sourceFiles={sourceFiles} onSourceClick={onSourceClick} />
              {message.isStreaming && (
                <span className="chat-cursor inline-block w-[2px] h-[13px] bg-accent-fill ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {/* Activity / Thinking state */}
          {!message.text && message.isStreaming && (
            <ActivityIndicator label={message.activityLabel} />
          )}

          {/* Proposed Updates */}
          {hasUpdates &&
            message.proposedUpdates!.map((update) => (
              <ProposedUpdateCard
                key={update.id}
                update={update}
                onAccept={() => onAcceptUpdate?.(update.id)}
                onReject={() => onRejectUpdate?.(update.id)}
              />
            ))}

          {/* Search Results */}
          {hasSearchResults && (
            <SearchResultsList results={message.searchResults!} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Exported Composite ── */

export function ChatMessageBubble({
  message,
  onAcceptUpdate,
  onRejectUpdate,
  sourceFiles,
  onSourceClick,
}: {
  message: ChatMessage;
  onAcceptUpdate?: (updateId: string) => void;
  onRejectUpdate?: (updateId: string) => void;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
}) {
  if (message.role === "user") {
    return <UserBubble text={message.text} attachments={message.attachments} />;
  }

  return (
    <AgentBubble
      message={message}
      onAcceptUpdate={onAcceptUpdate}
      onRejectUpdate={onRejectUpdate}
      sourceFiles={sourceFiles}
      onSourceClick={onSourceClick}
    />
  );
}
