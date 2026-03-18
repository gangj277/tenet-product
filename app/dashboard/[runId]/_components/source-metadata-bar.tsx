"use client";

import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";

export function SourceMetadataBar({
  paperQuality,
  sourceUrl,
}: {
  paperQuality?: PaperQualityMeta;
  sourceUrl?: string;
}) {
  if (!paperQuality && !sourceUrl) return null;

  const venue = paperQuality?.publication?.venue;
  const year = paperQuality?.publication?.year;
  const citations = paperQuality?.metrics?.citationCount;
  const influential = paperQuality?.metrics?.influentialCitationCount;
  const labels = paperQuality?.hints?.labels ?? [];
  const doi = paperQuality?.ids?.doi;
  const arxivId = paperQuality?.ids?.arxivId;

  const doiUrl = doi ? `https://doi.org/${doi}` : undefined;
  const arxivPdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined;
  const linkUrl = sourceUrl || doiUrl;

  const hasInfo = venue || year || typeof citations === "number" || labels.length > 0 || linkUrl;
  if (!hasInfo) return null;

  return (
    <div className="flex items-center gap-3 px-6 sm:px-10 lg:px-14 py-2 border-b border-edge/20 bg-panel/20 text-[11px] text-dim flex-shrink-0 flex-wrap">
      {/* Venue + year */}
      {(venue || year) && (
        <span className="flex items-center gap-1 text-sub font-medium">
          {venue}
          {venue && year && <span className="text-dim">&middot;</span>}
          {year}
        </span>
      )}

      {/* Citation stats */}
      {typeof citations === "number" && (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span>{citations.toLocaleString()} cited</span>
          {typeof influential === "number" && influential > 0 && (
            <span className="text-dim">&middot; {influential} influential</span>
          )}
        </span>
      )}

      {/* Quality labels */}
      {labels.length > 0 && (
        <div className="flex items-center gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className={`px-1.5 py-0.5 rounded border leading-none text-[9px] font-medium ${getLabelStyle(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* External links */}
      <div className="flex items-center gap-2">
        {arxivPdfUrl && (
          <a
            href={arxivPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-page/80 text-dim hover:text-sub transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            PDF
          </a>
        )}
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-page/80 text-dim hover:text-sub transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Source
          </a>
        )}
      </div>
    </div>
  );
}

function getLabelStyle(label: string): string {
  switch (label) {
    case "Highly cited":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "Influential":
      return "bg-violet-500/15 text-violet-400 border-violet-500/20";
    case "Cross-indexed":
      return "bg-sky-500/12 text-sky-400 border-sky-500/20";
    case "Open access":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "Preprint":
      return "bg-surface/60 text-dim border-edge/30";
    default:
      return "bg-surface/60 text-dim border-edge/30";
  }
}
