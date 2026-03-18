"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LATEX_TEMPLATE } from "./_lib/default-template";
import dynamic from "next/dynamic";
import { LatexEditor } from "./_components/latex-editor";
import { ErrorPanel } from "./_components/error-panel";
import { SplitPane } from "./_components/split-pane";

const PdfPreview = dynamic(
  () => import("./_components/pdf-preview").then((m) => m.PdfPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-dim text-sm">
        Loading PDF viewer…
      </div>
    ),
  },
);

type Status = "idle" | "compiling";
type ErrorInfo = { stderr?: string; stdout?: string } | null;

export default function LatexTestPage() {
  const [source, setSource] = useState(DEFAULT_LATEX_TEMPLATE);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>(null);
  const prevUrlRef = useRef<string | null>(null);
  const compilingRef = useRef(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const compile = useCallback(async () => {
    if (compilingRef.current) return;
    compilingRef.current = true;
    setStatus("compiling");
    setErrorInfo(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch("/api/compile-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tex: sourceRef.current }),
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
      setStatus("idle");
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

  return (
    <div className="h-screen flex flex-col bg-page">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-edge/30 bg-panel/50 flex-shrink-0">
        <h1 className="text-sm font-semibold text-heading">LaTeX Editor</h1>
        <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-fill/15 text-accent">
          Test
        </span>
        <div className="flex-1" />
        <button
          onClick={compile}
          disabled={status === "compiling"}
          className="text-xs font-medium px-3 py-1.5 rounded bg-accent-fill text-on-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {status === "compiling" ? "Compiling…" : "Compile"}
        </button>
        <span className="text-[10px] text-dim">⌘+Enter</span>
      </div>

      {/* Split pane */}
      <SplitPane
        left={<LatexEditor value={source} onChange={setSource} />}
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
