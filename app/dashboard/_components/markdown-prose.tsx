"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildSourceLookup,
  linkifyCitations,
  parseSourceHref,
  type LineRange,
  type SourceRef,
} from "../_lib/citation-utils";

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
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-[22px] font-medium text-heading mb-4 mt-8 first:mt-0 tracking-[-0.01em]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-[17px] font-medium text-heading mb-3 mt-7 first:mt-0 tracking-[-0.01em]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-sans text-[14px] font-semibold text-heading mb-2 mt-5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-[13.5px] leading-[1.78] text-body mb-3">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-3 space-y-1.5 text-[13.5px] leading-[1.78] text-body marker:text-dim">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-3 space-y-1.5 text-[13.5px] leading-[1.78] text-body">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[13.5px] leading-[1.78] text-body">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent-fill pl-4 my-4 text-heading">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-heading">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-heading italic">{children}</em>
          ),
          pre: ({ children }) => (
            <pre className="bg-ink-950/5 dark:bg-ink-50/5 rounded-md px-4 py-3 text-[12.5px] leading-[1.6] font-mono overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            if (className?.includes("language-")) {
              return <code className="font-mono">{children}</code>;
            }
            return (
              <code className="bg-ink-950/5 dark:bg-ink-50/5 rounded px-1.5 py-0.5 text-[12.5px] font-mono text-heading">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[13px] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-edge">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left font-semibold text-heading px-3 py-2 text-[12px] uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-edge/30 text-body">
              {children}
            </td>
          ),
          hr: () => <hr className="my-6 border-edge/40" />,
          a: ({ href, children }) => {
            // Source citation link → navigate to source file
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

            // Regular link
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
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
