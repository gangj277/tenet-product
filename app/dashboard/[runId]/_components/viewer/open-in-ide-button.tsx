"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function OpenInIdeButton({
  runId,
  fileKey,
}: {
  runId: string;
  fileKey: string;
}) {
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState("Open in IDE");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAvailable(Boolean(window.electronAPI?.isElectron));

    return () => {
      if (resetRef.current) {
        clearTimeout(resetRef.current);
      }
    };
  }, []);

  const handleOpen = useCallback(async () => {
    if (!window.electronAPI?.isElectron) {
      return;
    }

    if (resetRef.current) {
      clearTimeout(resetRef.current);
    }

    setLabel("Opening…");

    try {
      const response = await fetch(
        `/api/init/${runId}/open-local-file?key=${encodeURIComponent(fileKey)}`,
        {
          method: "POST",
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: "cursor" | "vscode" | "default" | "revealed";
        error?: string;
      };

      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Unable to open the local workspace file.");
      }

      setLabel(body.mode === "revealed" ? "Revealed" : "Opened");
    } catch {
      setLabel("Open failed");
    } finally {
      resetRef.current = setTimeout(() => {
        setLabel("Open in IDE");
      }, 1800);
    }
  }, [fileKey, runId]);

  if (!available) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub"
      title="Open this local workspace file in Cursor or another installed editor"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v12m6-6H6"
        />
      </svg>
      {label}
    </button>
  );
}
