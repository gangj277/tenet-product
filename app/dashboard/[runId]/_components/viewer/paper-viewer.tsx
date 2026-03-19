"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { LatexEditor } from "@/app/test/latex/_components/latex-editor";
import { ErrorPanel } from "@/app/test/latex/_components/error-panel";
import { SplitPane } from "@/app/test/latex/_components/split-pane";
import type { FileEntry } from "../../_lib/workspace-types";

const PdfPreview = dynamic(
  () => import("@/app/test/latex/_components/pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-dim text-sm">
        Loading PDF viewer…
      </div>
    ),
  },
);

type CompileStatus = "idle" | "compiling";
type ErrorInfo = { stderr?: string; stdout?: string } | null;

export function PaperViewer({
  activeFile,
  content,
  onUpdate,
  saveStatus = "idle",
  expanded,
  onToggleExpanded,
}: {
  activeFile: FileEntry;
  content: string;
  onUpdate: (latex: string) => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>("idle");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>(null);
  const [copied, setCopied] = useState(false);
  const prevUrlRef = useRef<string | null>(null);
  const compilingRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(contentRef.current).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, []);

  const compile = useCallback(async () => {
    if (compilingRef.current) return;
    compilingRef.current = true;
    setCompileStatus("compiling");
    setErrorInfo(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch("/api/compile-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex: contentRef.current }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const blob = await res.blob();
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setPdfUrl(url);
      } else {
        const data = await res.json();
        setErrorInfo({ stderr: data.stderr, stdout: data.stdout });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorInfo({ stderr: msg.includes("abort") ? "Compilation timed out (120s)" : msg });
    } finally {
      compilingRef.current = false;
      setCompileStatus("idle");
    }
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        compile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [compile]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  // Reset PDF when switching papers
  useEffect(() => {
    setPdfUrl(null);
    setErrorInfo(null);
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
  }, [activeFile.key]);

  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[12px] text-sub truncate max-w-[300px]" title={activeFile.label}>
            {activeFile.label}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            LaTeX
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub"
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

          {/* Expand / collapse button */}
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              title={expanded ? "Exit full view" : "Full view"}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            >
              {expanded ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          )}

          {/* Compile button */}
          <button
            onClick={compile}
            disabled={compileStatus === "compiling"}
            className="text-xs font-medium px-3 py-1.5 rounded bg-accent-fill text-on-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {compileStatus === "compiling" ? "Compiling…" : "Compile"}
          </button>
          <span className="text-[10px] text-dim">⌘+Enter</span>
        </div>
      </div>

      {/* Split pane: editor + preview */}
      <SplitPane
        left={<LatexEditor value={content} onChange={onUpdate} />}
        right={<PdfPreview pdfUrl={pdfUrl} />}
      />

      {/* Error panel */}
      {errorInfo && (
        <ErrorPanel
          stderr={errorInfo.stderr}
          stdout={errorInfo.stdout}
          onDismiss={() => setErrorInfo(null)}
        />
      )}
    </div>
  );
}
