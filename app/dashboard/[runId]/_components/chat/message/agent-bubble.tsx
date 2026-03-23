import type { ChatMessage } from "../../../_lib/workspace-types";
import type { LineRange, SourceRef } from "../../../../_lib/citation-utils";
import { ChatMarkdown } from "../chat-markdown";
import { ActivityIndicator } from "./activity-indicator";
import { ProposedUpdateCard } from "./proposed-update-card";
import { AskUserCard } from "./ask-user-card";
import { SearchResultsList } from "./search-results-list";
// TaskProgressCard removed — task plan now renders in persistent panel above chat
import { ProcessTraceCard } from "./process-trace-card";

export function AgentBubble({
  message,
  onAcceptUpdate,
  onRejectUpdate,
  onAnswerQuestion,
  onOpenProposal,
  sourceFiles,
  onSourceClick,
  getContent,
}: {
  message: ChatMessage;
  onAcceptUpdate?: (updateId: string) => void;
  onRejectUpdate?: (updateId: string) => void;
  onAnswerQuestion?: (questionId: string, answer: string, isCustom: boolean) => void;
  onOpenProposal?: (fileKey: string) => void;
  sourceFiles?: SourceRef[];
  onSourceClick?: (sourceKey: string, lineRange?: LineRange) => void;
  getContent?: (key: string) => string;
}) {
  const hasUpdates = message.proposedUpdates && message.proposedUpdates.length > 0;
  const hasSearchResults = message.searchResults && message.searchResults.length > 0;
  const hasProcessTrace = message.processTrace && message.processTrace.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
          <span className="w-[5px] h-[5px] rounded-full bg-dot" />
          <span className="text-[10px] font-medium text-dim uppercase tracking-[0.06em]">
            Research Assistant
          </span>
        </div>
        <div className="glass-panel rounded-2xl rounded-tl-sm px-4 py-3">
          {hasProcessTrace && (
            <ProcessTraceCard steps={message.processTrace!} />
          )}

          {message.text && (
            <div>
              <ChatMarkdown content={message.text} sourceFiles={sourceFiles} onSourceClick={onSourceClick} />
              {message.isStreaming && (
                <span className="chat-cursor inline-block w-[2px] h-[13px] bg-accent-fill ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {!message.text && message.isStreaming && !hasProcessTrace && (
            <ActivityIndicator label={message.activityLabel} />
          )}

          {/* Task plan now renders in persistent panel — see TaskPlanPanel */}

          {hasUpdates &&
            message.proposedUpdates!.map((update) => (
              <ProposedUpdateCard
                key={update.id}
                update={update}
                onAccept={() => onAcceptUpdate?.(update.id)}
                onReject={() => onRejectUpdate?.(update.id)}
                onOpen={() => onOpenProposal?.(update.key)}
                currentContent={update.type === "edit" && getContent ? getContent(update.key) : undefined}
              />
            ))}

          {message.askUserQuestion && (
            <AskUserCard
              question={message.askUserQuestion}
              onAnswer={(answer, isCustom) =>
                onAnswerQuestion?.(message.askUserQuestion!.id, answer, isCustom)
              }
            />
          )}

          {hasSearchResults && <SearchResultsList results={message.searchResults!} />}
        </div>
      </div>
    </div>
  );
}
