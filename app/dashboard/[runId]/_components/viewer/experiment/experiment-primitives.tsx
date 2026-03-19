export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[14px] font-medium text-heading tracking-[-0.005em] mb-4 flex items-center gap-2.5">
      <span>{children}</span>
      <span className="flex-1 h-px bg-edge/20" />
    </h2>
  );
}

export function Micro({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-dim">
      {children}
    </span>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="text-[12px] text-sub">
      <span className="text-dim">{label}:</span>{" "}
      <span className="font-medium text-body">{value}</span>
    </span>
  );
}

export function DetailBlock({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div>
      <Micro>{label}</Micro>
      <p className="text-[12.5px] text-body mt-1.5 leading-[1.65]">{text}</p>
    </div>
  );
}

export function ParamChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03]">
      <span className="text-dim font-medium">{label}</span>
      <span className="text-body font-medium">{value}</span>
    </span>
  );
}

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-[12px] text-dim hover:text-accent transition-colors flex items-center gap-1.5 cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {label}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="opacity-0 group-hover/item:opacity-100 text-dim hover:text-red-400 transition-all flex-shrink-0 cursor-pointer"
      aria-label="Remove"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
