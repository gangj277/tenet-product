"use client";

import { useState } from "react";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import { formatCitations } from "./message-utils";

const SEARCH_RESULTS_PREVIEW = 5;

const LABEL_COLORS: Record<string, string> = {
  "Highly cited": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Influential: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "Cross-indexed": "bg-sky-500/12 text-sky-400 border-sky-500/20",
  "Open access": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Preprint: "bg-surface/60 text-dim border-edge/30",
};

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
      <svg className="w-3.5 h-3.5 text-dim group-hover:text-sub flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
      <div className="flex-1 min-w-0">
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

export function SearchResultsList({ results }: { results: DiscoveredSource[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = results.length > SEARCH_RESULTS_PREVIEW;
  const visible = expanded ? results : results.slice(0, SEARCH_RESULTS_PREVIEW);
  const hiddenCount = results.length - SEARCH_RESULTS_PREVIEW;

  return (
    <div className="mt-3 pt-2.5 border-t border-edge/20">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3 h-3 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <span className="text-[10px] font-semibold text-dim uppercase tracking-wider">
          Sources Found
        </span>
        <span className="text-[9px] text-mute">{results.length}</span>
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
