export function SectionHeader({
  title,
  count,
  open,
  onToggle,
  trailing,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center w-full px-3 py-1.5">
      <button
        onClick={onToggle}
        className="flex items-center flex-1 text-[10px] font-semibold uppercase tracking-wider text-dim hover:text-sub transition-colors cursor-pointer select-none"
      >
        <svg
          className={`w-3 h-3 mr-1.5 transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="flex-1 text-left">{title}</span>
        <span className="text-[9px] text-dim tabular-nums">{count}</span>
      </button>
      {trailing}
    </div>
  );
}
