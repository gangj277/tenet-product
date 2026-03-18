"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";

const LEFT_MIN = 300;
const LEFT_MAX_PERCENT = 0.7;
const DEFAULT_PERCENT = 0.5;

export function SplitPane({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftFraction, setLeftFraction] = useState(DEFAULT_PERCENT);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const fraction = x / rect.width;
        const minFraction = LEFT_MIN / rect.width;
        setLeftFraction(Math.min(LEFT_MAX_PERCENT, Math.max(minFraction, fraction)));
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
    [],
  );

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left pane (editor) */}
      <div className="overflow-hidden" style={{ width: `${leftFraction * 100}%` }}>
        {left}
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={onPointerDown}
        className="w-[5px] flex-shrink-0 cursor-col-resize relative z-10 group"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-edge/30 group-hover:bg-accent-fill/50 transition-colors" />
      </div>

      {/* Right pane (preview) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
