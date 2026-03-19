import type { ChatMessage } from "../../../_lib/workspace-types";
import type { LineRange, SourceRef } from "../../../../_lib/citation-utils";
import { UserBubble } from "./user-bubble";
import { AgentBubble } from "./agent-bubble";

export function ChatMessageBubble({
  message,
  onAcceptUpdate,
  onRejectUpdate,
  onAnswerQuestion,
  sourceFiles,
  onSourceClick,
  getContent,
}: {
  message: ChatMessage;
  onAcceptUpdate?: (updateId: string) => void;
  onRejectUpdate?: (updateId: string) => void;
  onAnswerQuestion?: (questionId: string, answer: string, isCustom: boolean) => void;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
  getContent?: (key: string) => string;
}) {
  if (message.role === "user") {
    return <UserBubble text={message.text} attachments={message.attachments} />;
  }

  return (
    <AgentBubble
      message={message}
      onAcceptUpdate={onAcceptUpdate}
      onRejectUpdate={onRejectUpdate}
      onAnswerQuestion={onAnswerQuestion}
      sourceFiles={sourceFiles}
      onSourceClick={onSourceClick}
      getContent={getContent}
    />
  );
}
