import type { ChatAttachmentInfo } from "../../../_lib/workspace-types";

export function UserBubble({
  text,
  attachments,
}: {
  text: string;
  attachments?: ChatAttachmentInfo[];
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-accent-fill/8 rounded-2xl rounded-br-sm px-4 py-2.5">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((att, i) =>
              att.type === "image" && att.previewUrl ? (
                <img
                  key={i}
                  src={att.previewUrl}
                  alt={att.name}
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-edge/20"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-page/40 border border-edge/30"
                >
                  <svg className="w-3.5 h-3.5 text-dim flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-[10.5px] text-sub truncate max-w-[140px]">{att.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {text && (
          <p className="text-[12.5px] leading-[1.65] text-heading whitespace-pre-wrap">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
