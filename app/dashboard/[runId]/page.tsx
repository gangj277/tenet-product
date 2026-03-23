"use client";

import { use, useRef } from "react";
import Link from "next/link";
import { useWorkspace } from "./_hooks/use-workspace";
import { WorkspaceLayout } from "./_components/layout";
import { FileSidebar } from "./_components/sidebar";
import { DocumentViewer } from "./_components/viewer";
import { AgentChat, type ChatComposerHandle } from "./_components/chat";
import { findPendingUpdateForFile } from "./_lib/workspace-types";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const ws = useWorkspace(runId);
  const chatRef = useRef<ChatComposerHandle>(null);

  const handleQuoteToChat = (text: string, sourceLabel: string) => {
    if (ws.chatCollapsed) ws.toggleChat();
    chatRef.current?.injectQuotedContext(text, sourceLabel);
  };

  if (ws.loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-72px)]">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent-fill border-t-transparent rounded-full animate-spin" />
          <span className="font-sans text-[14px] text-sub">
            Loading workspace...
          </span>
        </div>
      </div>
    );
  }

  if (ws.error || !ws.artifacts) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-72px)]">
        <div className="text-center">
          <p className="font-sans text-[14px] text-sub mb-4">
            {ws.error || "No results found"}
          </p>
          <Link
            href="/dashboard"
            className="font-sans text-[13px] text-accent hover:text-accent-hover transition-colors"
          >
            Start a new project
          </Link>
        </div>
      </div>
    );
  }

  const activeFile = ws.files.find((f) => f.key === ws.activeFileKey);
  const pendingUpdate = ws.activeFileKey
    ? findPendingUpdateForFile(ws.chatMessages, ws.activeFileKey)
    : null;

  return (
    <WorkspaceLayout
      chatCollapsed={ws.chatCollapsed}
      sidebarCollapsed={ws.sidebarCollapsed}
      expanded={ws.expanded}
      onToggleSidebar={ws.toggleSidebar}
      onToggleChat={ws.toggleChat}
      sidebar={
        <FileSidebar
          files={ws.files}
          activeFileKey={ws.activeFileKey}
          onSelect={ws.setActiveFileKey}
          onDelete={ws.deleteFile}
          onCreateNote={ws.createNote}
          onMoveNote={ws.moveNote}
          onRenameNote={ws.renameNote}
          onAddSource={ws.addSource}
          onCreateExperiment={ws.createExperiment}
        />
      }
      document={
        <DocumentViewer
          activeFile={activeFile}
          content={ws.getContent(ws.activeFileKey)}
          onUpdate={(md) => ws.updateContent(ws.activeFileKey, md)}
          onNavigateSource={ws.navigateToSource}
          sourceFiles={ws.files}
          saveStatus={ws.saveStatus}
          onSave={ws.saveNow}
          pendingLineRange={ws.pendingLineRange}
          onScrollComplete={ws.clearPendingLineRange}
          expanded={ws.expanded}
          onToggleExpanded={ws.toggleExpanded}
          pendingUpdate={pendingUpdate}
          onAcceptUpdate={ws.acceptProposedUpdate}
          onRejectUpdate={ws.rejectProposedUpdate}
          onQuoteToChat={handleQuoteToChat}
        />
      }
      chat={
        <AgentChat
          ref={chatRef}
          messages={ws.chatMessages}
          agentTyping={ws.agentTyping}
          collapsed={ws.chatCollapsed}
          onToggle={ws.toggleChat}
          onSend={ws.sendMessage}
          onAcceptUpdate={ws.acceptProposedUpdate}
          onRejectUpdate={ws.rejectProposedUpdate}
          onAnswerQuestion={ws.answerQuestion}
          onOpenProposal={ws.setActiveFileKey}
          reasoningEffort={ws.reasoningEffort}
          onReasoningEffortChange={ws.setReasoningEffort}
          sessions={ws.sessions}
          activeSessionId={ws.activeSessionId}
          showHistory={ws.showHistory}
          onToggleHistory={ws.toggleHistory}
          onSelectSession={ws.loadSession}
          onNewSession={ws.createNewSession}
          onDeleteSession={ws.deleteSession}
          onRenameSession={ws.renameSession}
          files={ws.files}
          onNavigateSource={ws.navigateToSource}
          searchFilters={ws.searchFilters}
          onSearchFiltersChange={ws.setSearchFilters}
          getContent={ws.getContent}
          autoAcceptEdits={ws.autoAcceptEdits}
          onAutoAcceptEditsChange={ws.toggleAutoAcceptEdits}
          activeTaskPlan={ws.activeTaskPlan}
          onDismissTaskPlan={ws.dismissTaskPlan}
        />
      }
    />
  );
}
