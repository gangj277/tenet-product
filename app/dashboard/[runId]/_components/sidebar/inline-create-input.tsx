import { useEffect, useRef, useState } from "react";
import { FOLDER_ICON_PATH, ICON_PATHS } from "./sidebar-icons";

export function InlineCreateInput({
  onSubmit,
  onCancel,
  icon,
  placeholder,
}: {
  onSubmit: (label: string) => void;
  onCancel: () => void;
  icon: "note" | "folder" | "experiment";
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const iconPath =
    icon === "folder"
      ? FOLDER_ICON_PATH
      : icon === "experiment"
        ? ICON_PATHS.experiment
        : ICON_PATHS.note;

  return (
    <div className="flex items-center gap-2 px-5 py-[5px]">
      <svg
        className="w-[14px] h-[14px] flex-shrink-0 text-dim"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={iconPath} />
      </svg>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          const trimmed = value.trim();
          if (trimmed) onSubmit(trimmed);
          else onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-b border-accent-fill/40 text-[12px] text-heading outline-none placeholder:text-dim/50 px-0 py-0"
      />
    </div>
  );
}
