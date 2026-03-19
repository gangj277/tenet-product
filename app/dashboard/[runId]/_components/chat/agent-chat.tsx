"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChatMessage, FileEntry, SessionSummary } from "../../_lib/workspace-types";
import type { LineRange, SourceRef } from "../../../_lib/citation-utils";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import { ChatMessageBubble } from "./message/chat-message";
import { SessionHistory } from "./session-history";
import { ChatComposer } from "./chat-composer";

const SUGGESTED_PROMPTS = [
  "Summarize the key findings",
  "What are the strongest claims?",
  "Find contradictions across sources",
  "Suggest follow-up research",
];

function CollapsedRail({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="h-full flex flex-col items-center pt-3">
      <button
        onClick={onToggle}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
        title="Expand chat"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}

function ChatHeader({
  onToggle,
  onToggleHistory,
  onNewSession,
}: {
  onToggle: () => void;
  onToggleHistory: () => void;
  onNewSession: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/30 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-dot animate-ping opacity-40" />
          <span className="relative rounded-full h-2 w-2 bg-dot glow-violet" />
        </span>
        <div>
          <span className="font-sans text-[12px] font-semibold text-heading leading-none">
            Research Assistant
          </span>
          <span className="block text-[9.5px] text-dim mt-0.5 tracking-wide">
            Analyzes sources, suggests edits
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleHistory}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
          title="Chat history"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={onNewSession}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
          title="New chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
          title="Collapse chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HistoryPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onToggle,
  onToggleHistory,
}: {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onToggle: () => void;
  onToggleHistory: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleHistory}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            title="Back to chat"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-sans text-[12px] font-semibold text-heading">
            Chat History
          </span>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
          title="Collapse chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <SessionHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={onSelectSession}
          onNew={onNewSession}
          onDelete={onDeleteSession}
          onRename={onRenameSession}
        />
      </div>
    </div>
  );
}

function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-10 h-10 rounded-xl bg-dot/8 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-dot" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
      </div>
      <p className="font-sans text-[13px] font-medium text-heading mb-1">
        Research Assistant
      </p>
      <p className="font-sans text-[11.5px] text-dim leading-relaxed max-w-[240px] mb-5">
        Ask questions about your research, request edits to any document,
        or discover new sources.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSuggestion(prompt)}
            className="px-2.5 py-1.5 text-[11px] text-sub hover:text-heading bg-page/60 hover:bg-page border border-edge/30 hover:border-edge/50 rounded-lg transition-all cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
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
          <div className="space-y-2.5 py-0.5">
            <div className="flex items-center gap-2">
              <svg className="activity-spinner w-3.5 h-3.5 text-dot" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-[11.5px] text-sub">
                Analyzing your question
                <span className="chat-dot inline-block ml-0.5">.</span>
                <span className="chat-dot inline-block">.</span>
                <span className="chat-dot inline-block">.</span>
              </span>
            </div>
            <div className="activity-bar h-[2px] w-full rounded-full bg-dot/10">
              <div className="h-full w-1/3 rounded-full bg-dot/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentChat({
  messages,
  agentTyping,
  collapsed,
  onToggle,
  onSend,
  onAcceptUpdate,
  onRejectUpdate,
  onAnswerQuestion,
  sessions,
  activeSessionId,
  showHistory,
  onToggleHistory,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  files,
  onNavigateSource,
  searchFilters,
  onSearchFiltersChange,
  getContent,
  autoAcceptEdits,
  onAutoAcceptEditsChange,
  selectedModel,
  onModelChange,
}: {
  messages: ChatMessage[];
  agentTyping: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSend: (text: string, attachments?: File[]) => void;
  onAcceptUpdate?: (messageId: string, updateId: string) => void;
  onRejectUpdate?: (messageId: string, updateId: string) => void;
  onAnswerQuestion?: (messageId: string, questionId: string, answer: string, isCustom: boolean) => void;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  showHistory: boolean;
  onToggleHistory: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  files: FileEntry[];
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
  searchFilters?: SearchFilterConfig;
  onSearchFiltersChange?: (filters: SearchFilterConfig) => void;
  getContent?: (key: string) => string;
  autoAcceptEdits?: boolean;
  onAutoAcceptEditsChange?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sourceFiles: SourceRef[] = useMemo(
    () => files.map((file) => ({ key: file.key, label: file.shortLabel, group: file.group })),
    [files]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentTyping]);

  if (collapsed) {
    return <CollapsedRail onToggle={onToggle} />;
  }

  if (showHistory) {
    return (
      <HistoryPanel
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
        onToggle={onToggle}
        onToggleHistory={onToggleHistory}
      />
    );
  }

  const isEmpty = messages.length === 0 && !agentTyping;

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        onToggle={onToggle}
        onToggleHistory={onToggleHistory}
        onNewSession={onNewSession}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {isEmpty && <EmptyState onSuggestion={(text) => onSend(text)} />}

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onAcceptUpdate={
              onAcceptUpdate ? (updateId) => onAcceptUpdate(msg.id, updateId) : undefined
            }
            onRejectUpdate={
              onRejectUpdate ? (updateId) => onRejectUpdate(msg.id, updateId) : undefined
            }
            onAnswerQuestion={
              onAnswerQuestion
                ? (questionId, answer, isCustom) =>
                    onAnswerQuestion(msg.id, questionId, answer, isCustom)
                : undefined
            }
            sourceFiles={sourceFiles}
            onSourceClick={onNavigateSource}
            getContent={getContent}
          />
        ))}

        {agentTyping && !messages.some((message) => message.isStreaming) && (
          <ThinkingIndicator />
        )}
      </div>

      <ChatComposer
        agentTyping={agentTyping}
        files={files}
        onSend={onSend}
        searchFilters={searchFilters}
        onSearchFiltersChange={onSearchFiltersChange}
        autoAcceptEdits={autoAcceptEdits}
        onAutoAcceptEditsChange={onAutoAcceptEditsChange}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />
    </div>
  );
}
