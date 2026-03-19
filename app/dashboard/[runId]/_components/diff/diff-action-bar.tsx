"use client";

import { useCallback, useEffect } from "react";

export function DiffActionBar({
  summary,
  onAccept,
  onReject,
}: {
  summary: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        onAccept();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        onReject();
      }
    },
    [onAccept, onReject]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="sticky bottom-4 z-30 flex justify-center pointer-events-none mt-4">
      <div className="pointer-events-auto glass-panel rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg border border-edge/40">
        <span className="text-[11.5px] text-sub max-w-[240px] truncate">
          {summary}
        </span>

        <div className="w-px h-4 bg-edge/30" />

        <button
          type="button"
          onClick={onReject}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium cursor-pointer transition-all hover:bg-surface/80 text-sub hover:text-heading"
        >
          Undo
          <kbd className="ml-0.5 text-[9.5px] text-dim/60 font-mono bg-surface/50 px-1 py-0.5 rounded border border-edge/20">
            {"\u2318"}N
          </kbd>
        </button>

        <button
          type="button"
          onClick={onAccept}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium cursor-pointer transition-all bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/25"
        >
          Keep
          <kbd className="ml-0.5 text-[9.5px] text-emerald-500/50 dark:text-emerald-400/50 font-mono bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
            {"\u2318"}Y
          </kbd>
        </button>
      </div>
    </div>
  );
}
