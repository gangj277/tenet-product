"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildSourceLookup,
  linkifyCitations,
  parseSourceHref,
  type LineRange,
  type SourceRef,
} from "../../../_lib/citation-utils";

/**
 * Compact markdown renderer for chat messages.
 * Tighter spacing and smaller type than the document viewer's MarkdownProse,
 * but full GFM support (headings, bold, lists, code, links, tables).
 */
export function ChatMarkdown({
  content,
  sourceFiles,
  onSourceClick,
}: {
  content: string;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
}) {
  const lookup = useMemo(
    () => (sourceFiles?.length ? buildSourceLookup(sourceFiles) : null),
    [sourceFiles]
  );

  const processed =
    onSourceClick && lookup ? linkifyCitations(content, lookup) : content;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="font-sans text-[13px] font-semibold text-heading mt-3 mb-1.5 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="font-sans text-[13px] font-semibold text-heading mt-3 mb-1.5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-sans text-[12px] font-semibold text-heading mt-2.5 mb-1 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-[12.5px] leading-[1.7] text-body mb-2 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-4 mb-2 last:mb-0 space-y-0.5 text-[12.5px] leading-[1.7] text-body marker:text-dim">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-4 mb-2 last:mb-0 space-y-0.5 text-[12.5px] leading-[1.7] text-body">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-[12.5px] leading-[1.7] text-body">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent-fill/60 pl-3 my-2 text-[12.5px] text-heading">
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
          <pre className="bg-ink-950/5 dark:bg-ink-50/5 rounded-md px-3 py-2 text-[11.5px] leading-[1.55] font-mono overflow-x-auto my-2">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          if (className?.includes("language-")) {
            return <code className="font-mono">{children}</code>;
          }
          return (
            <code className="bg-ink-950/5 dark:bg-ink-50/5 rounded px-1 py-0.5 text-[11.5px] font-mono text-heading">
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-[11.5px] border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-edge">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left font-semibold text-heading px-2 py-1.5 text-[11px] uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1.5 border-b border-edge/30 text-body">
            {children}
          </td>
        ),
        hr: () => <hr className="my-3 border-edge/40" />,
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
                className="inline-flex items-center gap-0.5 px-1 py-0.5 -my-0.5 rounded bg-accent-fill/8 text-accent text-[10.5px] font-medium hover:bg-accent-fill/15 transition-colors cursor-pointer align-baseline"
              >
                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  );
}
