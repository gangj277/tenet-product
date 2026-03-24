"use client";

export const REASONING_OPTIONS = [
  {
    value: "low",
    label: "Low",
    description: "Faster, lighter reasoning",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced depth and speed",
  },
  {
    value: "high",
    label: "High",
    description: "More deliberate analysis",
  },
  {
    value: "xhigh",
    label: "Extra high",
    description: "Deepest reasoning, slowest responses",
  },
] as const;

export function ReasoningGlyph({ active = false }: { active?: boolean }) {
  return (
    <span
      className={`relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border transition-all ${
        active
          ? "border-edge/50 text-heading shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
          : "border-edge/25 text-sub"
      }`}
      style={{
        background: active
          ? "linear-gradient(180deg, color-mix(in srgb, white 16%, transparent), color-mix(in srgb, var(--t-panel) 62%, transparent))"
          : "linear-gradient(180deg, color-mix(in srgb, white 7%, transparent), color-mix(in srgb, var(--t-panel) 46%, transparent))",
        boxShadow: active
          ? "0 6px 16px color-mix(in srgb, var(--t-shadow) 14%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
      aria-hidden="true"
    >
      <span
        className="pointer-events-none absolute inset-x-[5px] top-[3px] h-[7px] rounded-full opacity-80"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.02))",
        }}
      />
      <svg
        className="relative h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.85}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 4.75a3.25 3.25 0 00-3.25 3.25v.75a3.25 3.25 0 00-2 2.98v.5A3.25 3.25 0 006.5 15.9v.1a3.25 3.25 0 003.25 3.25M14.5 4.75a3.25 3.25 0 013.25 3.25v.75a3.25 3.25 0 012 2.98v.5a3.25 3.25 0 01-2.25 3.12v.1a3.25 3.25 0 01-3.25 3.25M12 4.25v15.5M9.25 9.25h2.5M8.75 14.75H12M12 9.25h2M12 14.75h3"
        />
      </svg>
    </span>
  );
}
