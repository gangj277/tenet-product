"use client";

import { useEffect, useRef, useState } from "react";

export function SelectionQuoteButton({
  rect,
  containerRef,
  onQuote,
}: {
  rect: DOMRect;
  containerRef: React.RefObject<HTMLElement | null>;
  onQuote: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    // Position above the selection, centered on it
    const top = rect.top - containerRect.top + scrollTop - 36;
    const left = rect.left - containerRect.left + rect.width / 2 - 36;

    setPosition({
      top: Math.max(4, top),
      left: Math.max(8, Math.min(left, container.clientWidth - 80)),
    });
  }, [rect, containerRef]);

  return (
    <button
      ref={btnRef}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onQuote();
      }}
      className="absolute z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-edge/40 shadow-lg text-[11px] font-medium text-sub hover:text-heading hover:border-accent-fill/40 transition-all cursor-pointer"
      style={{
        top: position.top,
        left: position.left,
        boxShadow:
          "0 4px 20px -4px rgba(0,0,0,0.3), 0 2px 8px -2px rgba(0,0,0,0.15)",
      }}
      title="Quote to chat"
    >
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
      Quote
    </button>
  );
}
