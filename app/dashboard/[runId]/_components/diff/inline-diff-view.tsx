"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

interface DiffSegment {
  type: "added" | "removed" | "unchanged";
  markdown: string;
}

/**
 * Full-document LCS diff — returns every line.
 */
function computeFullDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "removed", text: oldLines[i - 1] });
      i--;
    }
  }
  result.reverse();
  return result;
}

/**
 * Group consecutive diff lines of the same type into segments,
 * each containing joined markdown content.
 */
function groupIntoSegments(diff: DiffLine[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let current: DiffSegment | null = null;

  for (const line of diff) {
    if (current && current.type === line.type) {
      current.markdown += "\n" + line.text;
    } else {
      if (current) segments.push(current);
      current = { type: line.type, markdown: line.text };
    }
  }
  if (current) segments.push(current);
  return segments;
}

/* ── Shared ReactMarkdown components (mirrors MarkdownProse) ── */

const mdComponents: import("react-markdown").Components = {
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
    <p className="text-[13.5px] leading-[1.78] text-body mb-3">{children}</p>
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
    <li className="text-[13.5px] leading-[1.78] text-body">{children}</li>
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
      <table className="w-full text-[13px] border-collapse">{children}</table>
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
    <td className="px-3 py-2 border-b border-edge/30 text-body">{children}</td>
  ),
  hr: () => <hr className="my-6 border-edge/40" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-cite underline underline-offset-2 hover:text-accent transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export function InlineDiffView({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const segments = useMemo(() => {
    const diff = computeFullDiff(oldText.split("\n"), newText.split("\n"));
    return groupIntoSegments(diff);
  }, [oldText, newText]);

  const hasChanges = segments.some((s) => s.type !== "unchanged");

  if (!hasChanges) {
    return (
      <div className="text-[13px] text-dim italic py-8 text-center">
        No changes detected
      </div>
    );
  }

  return (
    <div className="synthesis-doc px-6 sm:px-10 lg:px-14">
      {segments.map((seg, i) => {
        if (seg.type === "unchanged") {
          return (
            <div key={i}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {seg.markdown}
              </ReactMarkdown>
            </div>
          );
        }

        if (seg.type === "removed") {
          return (
            <div
              key={i}
              className="relative -mx-6 sm:-mx-10 lg:-mx-14 px-6 sm:px-10 lg:px-14 bg-red-500/[0.06] dark:bg-red-500/[0.08] border-l-[3px] border-red-400/50 [&_*]:line-through [&_*]:decoration-red-400/30 [&_*]:decoration-[1.5px]"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {seg.markdown}
              </ReactMarkdown>
            </div>
          );
        }

        // added
        return (
          <div
            key={i}
            className="relative -mx-6 sm:-mx-10 lg:-mx-14 px-6 sm:px-10 lg:px-14 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border-l-[3px] border-emerald-400/50"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {seg.markdown}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}
