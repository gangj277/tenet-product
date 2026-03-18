"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const CHAT_MIN = 280;
const CHAT_MAX = 600;
const CHAT_DEFAULT = 380;

export function WorkspaceLayout({
  sidebar,
  document: documentPanel,
  chat,
  chatCollapsed,
  sidebarCollapsed,
  expanded,
  onToggleSidebar,
  onToggleChat,
}: {
  sidebar: ReactNode;
  document: ReactNode;
  chat: ReactNode;
  chatCollapsed: boolean;
  sidebarCollapsed?: boolean;
  expanded?: boolean;
  onToggleSidebar?: () => void;
  onToggleChat?: () => void;
}) {
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  // Keyboard shortcuts: Cmd+B (left sidebar), Cmd+K (right chat)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === "b") {
        e.preventDefault();
        onToggleSidebar?.();
      } else if (e.key === "k") {
        e.preventDefault();
        onToggleChat?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggleSidebar, onToggleChat]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (chatCollapsed) return;
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = chatWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const delta = startX.current - ev.clientX; // dragging left = wider
        const next = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startW.current + delta));
        setChatWidth(next);
      };

      const onUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [chatCollapsed, chatWidth],
  );

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden">
      {/* Left explorer panel */}
      {!sidebarCollapsed && !expanded && (
        <div className="w-[240px] flex-shrink-0 border-r border-edge/30 bg-panel/50 overflow-y-auto">
          {sidebar}
        </div>
      )}

      {/* Center document viewer */}
      <div className="flex-1 min-w-0 overflow-hidden">{documentPanel}</div>

      {!expanded && (
        <>
          {/* Resize handle */}
          {!chatCollapsed && (
            <div
              onPointerDown={onPointerDown}
              className="w-[5px] flex-shrink-0 cursor-col-resize relative z-10 group"
            >
              {/* Visible line on hover / drag */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-edge/30 group-hover:bg-accent-fill/50 transition-colors" />
            </div>
          )}

          {/* Right chat panel */}
          <div
            className={`flex-shrink-0 overflow-hidden ${
              chatCollapsed ? "w-[36px] border-l border-edge/30" : ""
            }`}
            style={chatCollapsed ? { width: 36 } : { width: chatWidth }}
          >
            {chat}
          </div>
        </>
      )}
    </div>
  );
}
