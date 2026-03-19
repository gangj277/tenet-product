"use client";

import type { LineRange } from "../../../_lib/citation-utils";
import type { FileEntry, PendingUpdateContext } from "../../_lib/workspace-types";
import { MarkdownDocumentViewer } from "./markdown-document-viewer";
import { PaperViewer } from "./paper-viewer";
import { ExperimentViewer } from "./experiment/experiment-viewer";

export function DocumentViewer({
  activeFile,
  content,
  onUpdate,
  onNavigateSource,
  sourceFiles,
  saveStatus = "idle",
  onSave,
  pendingLineRange,
  onScrollComplete,
  expanded,
  onToggleExpanded,
  pendingUpdate,
  onAcceptUpdate,
  onRejectUpdate,
}: {
  activeFile: FileEntry | undefined;
  content: string;
  onUpdate: (md: string) => void;
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
  sourceFiles?: Array<{ key: string; label: string; group: string }>;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
  pendingLineRange?: LineRange | null;
  onScrollComplete?: () => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  pendingUpdate?: PendingUpdateContext | null;
  onAcceptUpdate?: (messageId: string, updateId: string) => void;
  onRejectUpdate?: (messageId: string, updateId: string) => void;
}) {
  if (activeFile?.fileType === "latex") {
    return (
      <PaperViewer
        activeFile={activeFile}
        content={content}
        onUpdate={onUpdate}
        saveStatus={saveStatus}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
    );
  }

  if (
    activeFile?.fileType === "experiment-design" ||
    (activeFile?.group === "experiment" &&
      content.startsWith("{") &&
      (() => {
        try {
          const parsed = JSON.parse(content);
          return (
            typeof parsed?.researchQuestion === "string" &&
            Array.isArray(parsed?.hypotheses)
          );
        } catch {
          return false;
        }
      })())
  ) {
    return (
      <ExperimentViewer
        activeFile={activeFile}
        content={content}
        sourceFiles={sourceFiles}
        onNavigateSource={onNavigateSource}
        onUpdate={onUpdate}
        saveStatus={saveStatus}
        onSave={onSave}
        pendingUpdate={pendingUpdate}
        onAcceptUpdate={onAcceptUpdate}
        onRejectUpdate={onRejectUpdate}
      />
    );
  }

  return (
    <MarkdownDocumentViewer
      activeFile={activeFile}
      content={content}
      onUpdate={onUpdate}
      onNavigateSource={onNavigateSource}
      sourceFiles={sourceFiles}
      saveStatus={saveStatus}
      onSave={onSave}
      pendingLineRange={pendingLineRange}
      onScrollComplete={onScrollComplete}
      pendingUpdate={pendingUpdate}
      onAcceptUpdate={onAcceptUpdate}
      onRejectUpdate={onRejectUpdate}
    />
  );
}
