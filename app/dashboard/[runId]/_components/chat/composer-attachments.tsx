export function ComposerAttachments({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {files.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="group/att relative flex items-center gap-1 px-1.5 py-1 rounded-md bg-page/60 border border-edge/30"
        >
          {file.type.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-6 h-6 rounded object-cover"
            />
          ) : (
            <svg className="w-4 h-4 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
          <span className="text-[10px] text-sub truncate max-w-[80px]">
            {file.name}
          </span>
          <button
            onClick={() => onRemove(i)}
            className="opacity-0 group-hover/att:opacity-100 absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface border border-edge/40 flex items-center justify-center text-dim hover:text-heading transition-all cursor-pointer"
          >
            <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
