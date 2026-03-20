"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildSourceLookup,
  linkifyCitations,
  parseSourceHref,
  type LineRange,
  type SourceRef,
} from "../_lib/citation-utils";

// Stable reference — prevents ReactMarkdown from re-parsing on every render
const REMARK_PLUGINS = [remarkGfm];

// Static components that don't depend on any props
const MdH1 = ({ children }: { children?: React.ReactNode }) => (
  <h1 className="font-serif text-[22px] font-medium text-heading mb-4 mt-8 first:mt-0 tracking-[-0.01em]">
    {children}
  </h1>
);
const MdH2 = ({ children }: { children?: React.ReactNode }) => (
  <h2 className="font-serif text-[17px] font-medium text-heading mb-3 mt-7 first:mt-0 tracking-[-0.01em]">
    {children}
  </h2>
);
const MdH3 = ({ children }: { children?: React.ReactNode }) => (
  <h3 className="font-sans text-[14px] font-semibold text-heading mb-2 mt-5">
    {children}
  </h3>
);
const MdP = ({ children }: { children?: React.ReactNode }) => (
  <p className="text-[13.5px] leading-[1.78] text-body mb-3">{children}</p>
);
const MdUl = ({ children }: { children?: React.ReactNode }) => (
  <ul className="list-disc list-outside pl-5 mb-3 space-y-1.5 text-[13.5px] leading-[1.78] text-body marker:text-dim">
    {children}
  </ul>
);
const MdOl = ({ children }: { children?: React.ReactNode }) => (
  <ol className="list-decimal list-outside pl-5 mb-3 space-y-1.5 text-[13.5px] leading-[1.78] text-body">
    {children}
  </ol>
);
const MdLi = ({ children }: { children?: React.ReactNode }) => (
  <li className="text-[13.5px] leading-[1.78] text-body">{children}</li>
);
const MdBlockquote = ({ children }: { children?: React.ReactNode }) => (
  <blockquote className="border-l-2 border-accent-fill pl-4 my-4 text-heading">
    {children}
  </blockquote>
);
const MdStrong = ({ children }: { children?: React.ReactNode }) => (
  <strong className="font-semibold text-heading">{children}</strong>
);
const MdEm = ({ children }: { children?: React.ReactNode }) => (
  <em className="text-heading italic">{children}</em>
);
const MdPre = ({ children }: { children?: React.ReactNode }) => (
  <pre className="bg-ink-950/5 dark:bg-ink-50/5 rounded-md px-4 py-3 text-[12.5px] leading-[1.6] font-mono overflow-x-auto mb-3">
    {children}
  </pre>
);
const MdCode = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  if (className?.includes("language-")) {
    return <code className="font-mono">{children}</code>;
  }
  return (
    <code className="bg-ink-950/5 dark:bg-ink-50/5 rounded px-1.5 py-0.5 text-[12.5px] font-mono text-heading">
      {children}
    </code>
  );
};
const MdTable = ({ children }: { children?: React.ReactNode }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-[13px] border-collapse">{children}</table>
  </div>
);
const MdThead = ({ children }: { children?: React.ReactNode }) => (
  <thead className="border-b border-edge">{children}</thead>
);
const MdTh = ({ children }: { children?: React.ReactNode }) => (
  <th className="text-left font-semibold text-heading px-3 py-2 text-[12px] uppercase tracking-wider">
    {children}
  </th>
);
const MdTd = ({ children }: { children?: React.ReactNode }) => (
  <td className="px-3 py-2 border-b border-edge/30 text-body">{children}</td>
);
const MdHr = () => <hr className="my-6 border-edge/40" />;

export function MarkdownProse({
  content,
  sourceFiles,
  onSourceClick,
  pendingLineRange,
  onScrollComplete,
}: {
  content: string;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
  pendingLineRange?: LineRange | null;
  onScrollComplete?: () => void;
}) {
  const lookup = useMemo(
    () => (sourceFiles?.length ? buildSourceLookup(sourceFiles) : null),
    [sourceFiles]
  );

  const processed =
    onSourceClick && lookup ? linkifyCitations(content, lookup) : content;

  const containerRef = useRef<HTMLDivElement>(null);

  // Stable link component — only one that depends on props
  const MdA = useCallback(
    ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("#source:") && onSourceClick) {
        const parsed = parseSourceHref(href);
        return (
          <button
            type="button"
            onClick={() => {
              if (parsed) onSourceClick(parsed.sourceKey, parsed.lineRange);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 -my-0.5 rounded bg-accent-fill/8 text-accent text-[11px] font-medium hover:bg-accent-fill/15 transition-colors cursor-pointer align-baseline"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {children}
          </button>
        );
      }

      return (
        <a
          href={href}
          className="text-cite underline underline-offset-2 hover:text-accent transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    [onSourceClick]
  );

  // Stable components object — only changes when onSourceClick changes
  const components = useMemo(
    () => ({
      h1: MdH1,
      h2: MdH2,
      h3: MdH3,
      p: MdP,
      ul: MdUl,
      ol: MdOl,
      li: MdLi,
      blockquote: MdBlockquote,
      strong: MdStrong,
      em: MdEm,
      pre: MdPre,
      code: MdCode,
      table: MdTable,
      thead: MdThead,
      th: MdTh,
      td: MdTd,
      hr: MdHr,
      a: MdA,
    }),
    [MdA]
  );

  // Scroll to the line range text when pendingLineRange changes
  useEffect(() => {
    if (!pendingLineRange || !containerRef.current) return;

    const rafId = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      // Extract a text needle from the content lines
      const lines = content.split("\n");
      const start = Math.max(0, pendingLineRange.start - 1); // 1-indexed → 0-indexed
      const end = Math.min(lines.length, pendingLineRange.end);
      const targetLines = lines.slice(start, end);
      // Use the first non-empty line as the search needle
      const needle = targetLines.find((l) => l.trim().length > 0)?.trim();

      if (!needle) {
        onScrollComplete?.();
        return;
      }

      // Strip markdown formatting for plain text matching
      const plainNeedle = needle
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

      // Search block-level elements by textContent (handles inline formatting
      // that splits text across multiple child nodes)
      const blocks = container.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, pre",
      );
      let found: Element | null = null;
      for (const block of blocks) {
        if (block.textContent && block.textContent.includes(plainNeedle)) {
          found = block as Element;
          break;
        }
      }

      if (found) {
        found.scrollIntoView({ behavior: "smooth", block: "center" });
        found.classList.add("citation-highlight");
        setTimeout(() => {
          found!.classList.remove("citation-highlight");
        }, 2500);
      }

      onScrollComplete?.();
    });

    return () => cancelAnimationFrame(rafId);
  }, [pendingLineRange, content, onScrollComplete]);

  return (
    <div ref={containerRef} className="synthesis-doc">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
