import { AddButton, RemoveButton } from "./experiment-primitives";

export function EditableField({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent border-b border-edge/50 py-0.5 focus:outline-none focus:border-accent/50 transition-colors ${className}`}
      placeholder={placeholder}
    />
  );
}

export function EditableTextarea({
  value,
  onChange,
  className = "",
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`w-full bg-transparent border border-edge/50 rounded-md px-3 py-2 text-[13px] leading-[1.7] text-body focus:outline-none focus:border-accent/50 transition-colors resize-y ${className}`}
      placeholder={placeholder}
    />
  );
}

export function EditableStringList({
  items,
  onChange,
  placeholder = "Item...",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5 mt-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group/item">
          <span className="text-dim/60 flex-shrink-0">•</span>
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 bg-transparent border-b border-edge/50 text-[12.5px] text-body py-0.5 focus:outline-none focus:border-accent/50 transition-colors"
            placeholder={placeholder}
          />
          <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label="Add item" onClick={() => onChange([...items, ""])} />
    </div>
  );
}

export function EditableTagList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[11px] text-body font-medium px-2 py-[3px] rounded border border-edge/25 bg-ink-950/[0.02] dark:bg-ink-50/[0.03] group/tag"
        >
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="bg-transparent focus:outline-none w-auto min-w-[40px]"
            style={{ width: `${Math.max(3, item.length)}ch` }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-dim/40 hover:text-red-400 transition-colors cursor-pointer"
            aria-label="Remove level"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-[11px] text-dim hover:text-accent transition-colors px-1.5 py-[3px] rounded border border-dashed border-edge/30 hover:border-accent/30 cursor-pointer"
      >
        + level
      </button>
    </div>
  );
}
