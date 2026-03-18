"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { MarkdownProse } from "../../_components/markdown-prose";
import type { LineRange } from "../../_lib/citation-utils";
import type { FileEntry } from "../_lib/workspace-types";
import { PaperViewer } from "./paper-viewer";
import { SourceMetadataBar } from "./source-metadata-bar";

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
}) {
  // Route LaTeX papers to PaperViewer
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
    />
  );
}

function MarkdownDocumentViewer({
  activeFile,
  content,
  onUpdate,
  onNavigateSource,
  sourceFiles,
  saveStatus = "idle",
  onSave,
  pendingLineRange,
  onScrollComplete,
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
}) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const switchingRef = useRef(false);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "synthesis-doc prose-editor outline-none",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: e }) => {
      if (switchingRef.current) return;
      const markdown = e.storage.markdown.getMarkdown();
      onUpdate(markdown);
    },
  });

  // Sync content when entering edit mode or switching files
  useEffect(() => {
    if (!editor || !activeFile || !editing) return;
    switchingRef.current = true;
    editor.commands.setContent(content);
    requestAnimationFrame(() => {
      switchingRef.current = false;
    });
  }, [activeFile?.key, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const enterEdit = useCallback(() => setEditing(true), []);
  const exitEdit = useCallback(() => setEditing(false), []);

  // TipTap scroll-to-line-range in edit mode
  useEffect(() => {
    if (!pendingLineRange || !editing || !editor) return;

    // Wait for content to render after setContent
    const timer = setTimeout(() => {
      const lines = content.split("\n");
      const start = Math.max(0, pendingLineRange.start - 1);
      const end = Math.min(lines.length, pendingLineRange.end);
      const targetLines = lines.slice(start, end);
      const needle = targetLines.find((l) => l.trim().length > 0)?.trim();

      if (!needle) {
        onScrollComplete?.();
        return;
      }

      // Strip markdown formatting
      const plainNeedle = needle
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

      // Walk ProseMirror doc at block level — check textContent of each
      // block node to handle inline marks that split text across nodes
      let foundFrom = -1;
      let foundTo = -1;
      editor.state.doc.descendants((node, pos) => {
        if (foundFrom !== -1) return false;
        if (node.isBlock && node.isTextblock) {
          const blockText = node.textContent;
          const idx = blockText.indexOf(plainNeedle);
          if (idx !== -1) {
            // Map the character offset within the block to a ProseMirror position.
            // pos is the position of the block node itself; +1 enters its content.
            let charCount = 0;
            let resolvedFrom = -1;
            node.forEach((child, childOffset) => {
              if (resolvedFrom !== -1) return;
              const childLen = child.nodeSize;
              const childTextLen = child.isText ? (child.text?.length ?? 0) : 0;
              if (charCount + childTextLen > idx && resolvedFrom === -1) {
                resolvedFrom = pos + 1 + childOffset + (idx - charCount);
              }
              charCount += childTextLen;
            });
            if (resolvedFrom === -1) resolvedFrom = pos + 1 + idx;
            foundFrom = resolvedFrom;
            foundTo = foundFrom + plainNeedle.length;
            return false;
          }
        }
        return true;
      });

      if (foundFrom !== -1) {
        editor
          .chain()
          .setTextSelection({ from: foundFrom, to: foundTo })
          .scrollIntoView()
          .run();

        // Clear selection after 2.5s
        setTimeout(() => {
          if (editor && !editor.isDestroyed) {
            editor.commands.setTextSelection(foundTo);
          }
        }, 2500);
      }

      onScrollComplete?.();
    }, 100);

    return () => clearTimeout(timer);
  }, [pendingLineRange, editing, editor, content, onScrollComplete]);

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] text-dim">Select a file to view</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-edge/30 flex-shrink-0">
        <span className="font-mono text-[12px] text-sub truncate max-w-[400px]" title={activeFile.label}>
          {activeFile.label}
        </span>
        <div className="flex items-center gap-2">
          {/* Save status / manual save button */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-dim">
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
              Saving
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-dim">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[11px] font-medium text-red-500">Save failed</span>
          )}
          {editing && onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub disabled:opacity-40 disabled:cursor-default"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save
            </button>
          )}
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </>
            )}
          </button>
        <button
          onClick={editing ? exitEdit : enterEdit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer hover:bg-page text-dim hover:text-sub"
        >
          {editing ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit
            </>
          )}
        </button>
        </div>
      </div>

      {/* Source metadata bar */}
      {activeFile.group === "source" && (
        <SourceMetadataBar
          paperQuality={activeFile.paperQuality}
          sourceUrl={activeFile.sourceUrl}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-14 py-8">
        {editing ? (
          <EditorContent editor={editor} />
        ) : (
          <MarkdownProse
            content={content}
            sourceFiles={sourceFiles}
            onSourceClick={onNavigateSource}
            pendingLineRange={pendingLineRange}
            onScrollComplete={onScrollComplete}
          />
        )}
      </div>
    </div>
  );
}
