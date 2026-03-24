interface WorkspaceFolderFieldProps {
  workspacePath: string | null;
  disabled: boolean;
  onChoose: () => void;
}

export function WorkspaceFolderField({
  workspacePath,
  disabled,
  onChoose,
}: WorkspaceFolderFieldProps) {
  const hasSelection = !!workspacePath?.trim();

  return (
    <div className="reveal reveal-delay-3 mb-6 rounded-xl border border-edge/50 bg-panel/50 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim mb-2">
            Workspace folder
          </p>
          <p className="font-sans text-[13px] leading-[1.6] text-sub">
            Choose where this local workspace should be created.
          </p>
          {!hasSelection ? (
            <p className="font-sans text-[12px] text-dim mt-2">
              Required before you can start research or create a blank workspace.
            </p>
          ) : (
            <div className="mt-3">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-dim mb-1.5">
                Selected folder
              </p>
              <code className="block max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-edge/40 bg-page/70 px-3 py-2 text-[12px] text-body">
                {workspacePath}
              </code>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onChoose}
          disabled={disabled}
          className="shrink-0 rounded-lg border border-edge/50 px-3 py-2 font-sans text-[12px] font-medium text-sub transition-colors hover:border-accent/40 hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {hasSelection ? "Change folder" : "Choose folder"}
        </button>
      </div>
    </div>
  );
}
