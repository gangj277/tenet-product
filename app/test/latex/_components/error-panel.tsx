"use client";

import { useState } from "react";

export function ErrorPanel({
  stderr,
  stdout,
  onDismiss,
}: {
  stderr?: string;
  stdout?: string;
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-t border-red-500/40 bg-red-950/20">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          {collapsed ? "▶" : "▼"} Compilation Error
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-dim hover:text-body transition-colors"
        >
          Dismiss
        </button>
      </div>
      {!collapsed && (
        <div className="px-3 pb-3 max-h-[200px] overflow-y-auto">
          {stderr && (
            <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap break-words">
              {stderr}
            </pre>
          )}
          {stdout && (
            <pre className="text-xs font-mono text-dim whitespace-pre-wrap break-words mt-2">
              {stdout}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
