"use client";

import { useCallback, useRef, useState } from "react";
import type { SourceEntry } from "@/lib/engine/state";

interface FileUploadProps {
  sources: SourceEntry[];
  onSourcesChange: (sources: SourceEntry[]) => void;
  disabled?: boolean;
}

export function FileUpload({
  sources,
  onSourcesChange,
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfFiles = Array.from(files).filter(
        (f) => f.type === "application/pdf"
      );
      if (pdfFiles.length === 0) return;

      setUploading(true);
      try {
        const form = new FormData();
        for (const f of pdfFiles) form.append("files", f);

        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        onSourcesChange([...sources, ...data.sources]);
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [sources, onSourcesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!disabled) uploadFiles(e.dataTransfer.files);
    },
    [disabled, uploadFiles]
  );

  const removeSource = (sourceId: string) => {
    onSourcesChange(sources.filter((s) => s.sourceId !== sourceId));
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative border border-dashed rounded-lg px-6 py-8 text-center cursor-pointer
          transition-all duration-300
          ${
            isDragging
              ? "border-accent-fill bg-accent-fill/5 glow-accent-sm"
              : "border-mute/40 hover:border-mute/70"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          disabled={disabled}
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-4 h-4 border-2 border-accent-fill border-t-transparent rounded-full animate-spin" />
            <span className="font-sans text-[13px] text-sub">
              Uploading...
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-3">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-dim"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="font-sans text-[13px] text-sub mb-1">
              Drop PDF files here, or{" "}
              <span className="text-accent underline underline-offset-2">
                browse
              </span>
            </p>
            <p className="font-sans text-[11px] text-dim">
              Research papers, reports, articles
            </p>
          </>
        )}
      </div>

      {/* Uploaded files list */}
      {sources.length > 0 && (
        <div className="space-y-1.5">
          {sources.map((s) => (
            <div
              key={s.sourceId}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-page border border-edge/30"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-accent flex-shrink-0"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="font-mono text-[12px] text-sub truncate">
                  {s.name}
                </span>
              </div>
              {!disabled && (
                <button
                  onClick={() => removeSource(s.sourceId)}
                  className="text-dim hover:text-heading transition-colors flex-shrink-0 cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
