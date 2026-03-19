export function ActivityIndicator({ label }: { label?: string }) {
  return (
    <div className="space-y-2.5 py-0.5">
      <div className="flex items-center gap-2">
        <svg className="activity-spinner w-3.5 h-3.5 text-dot" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-[11.5px] text-sub">
          {label || "Thinking"}
          <span className="chat-dot inline-block ml-0.5">.</span>
          <span className="chat-dot inline-block">.</span>
          <span className="chat-dot inline-block">.</span>
        </span>
      </div>
      <div className="activity-bar h-[2px] w-full rounded-full bg-dot/10">
        <div className="h-full w-1/3 rounded-full bg-dot/40" />
      </div>
    </div>
  );
}
