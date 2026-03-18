"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type DragEvent } from "react";
import type { ChatMessage, FileEntry, SessionSummary } from "../_lib/workspace-types";
import type { LineRange, SourceRef } from "../../_lib/citation-utils";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import { SKILL_LIST, type SkillInfo } from "../_lib/skill-definitions";
import { ChatMessageBubble } from "./chat-message";
import { SessionHistory } from "./session-history";
import { SkillPicker } from "./skill-picker";
import { FileMentionPicker } from "./file-mention-picker";
import { SearchFilterPanel } from "../../_components/search-filter-panel";

/* ── Skill icon map (shared with skill-picker) ── */

const SKILL_ICONS: Record<string, string> = {
  "devils-advocate": "\u2694",
  "source-scout": "\u2609",
  "paper-explainer": "\u273F",
  "evidence-adjudicator": "\u2696",
  "synthesis-updater": "\u2B21",
  "methodology-critic": "\u2662",
};

function getSkillIcon(id: string): string {
  return SKILL_ICONS[id] ?? "\u2726";
}

/* ── Suggested prompt pills for empty state ── */

const SUGGESTED_PROMPTS = [
  "Summarize the key findings",
  "What are the strongest claims?",
  "Find contradictions across sources",
  "Suggest follow-up research",
];

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.gif,.webp,.pdf";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 20 * 1024 * 1024;   // 20MB
const MAX_ATTACHMENTS = 5;

export function AgentChat({
  messages,
  agentTyping,
  collapsed,
  onToggle,
  onSend,
  onAcceptUpdate,
  onRejectUpdate,
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
}: {
  messages: ChatMessage[];
  agentTyping: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSend: (text: string, attachments?: File[]) => void;
  onAcceptUpdate?: (messageId: string, updateId: string) => void;
  onRejectUpdate?: (messageId: string, updateId: string) => void;
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
}) {
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const slashTriggerRef = useRef<{
    node: Text;
    startOffset: number;
    query: string;
  } | null>(null);
  const atTriggerRef = useRef<{
    node: Text;
    startOffset: number;
    query: string;
  } | null>(null);

  // Build SourceRef[] from FileEntry[] for citation linkification in chat messages
  const sourceFiles: SourceRef[] = useMemo(
    () => files.map((f) => ({ key: f.key, label: f.shortLabel, group: f.group })),
    [files]
  );

  /* ── ContentEditable helpers ── */

  function serializeEditor(): string {
    const editor = editorRef.current;
    if (!editor) return "";
    let result = "";
    function walk(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node instanceof HTMLElement) {
        if (node.dataset.skillSlash) {
          result += node.dataset.skillSlash;
        } else if (node.dataset.fileLabel) {
          result += `@${node.dataset.fileLabel}`;
        } else if (node.tagName === "BR") {
          result += "\n";
        } else {
          node.childNodes.forEach(walk);
        }
      }
    }
    walk(editor);
    return result.replace(/\u200B/g, "").replace(/\u00A0/g, " ").trim();
  }

  function checkEditorEmpty(): boolean {
    const editor = editorRef.current;
    if (!editor) return true;
    const hasChips =
      editor.querySelectorAll("[data-skill-slash],[data-file-key]").length > 0;
    const text = (editor.textContent || "")
      .replace(/\u200B/g, "")
      .replace(/\u00A0/g, "")
      .trim();
    return !hasChips && text === "";
  }

  function findTriggerAtCursor(
    char: string,
  ): { node: Text; startOffset: number; query: string } | null {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed || !editor) return null;
    const { startContainer: node, startOffset: offset } = sel.getRangeAt(0);
    if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) return null;
    const text = node.textContent || "";
    const beforeCursor = text.slice(0, offset);
    const idx = beforeCursor.lastIndexOf(char);
    if (idx === -1) return null;
    if (idx > 0 && !/\s/.test(beforeCursor[idx - 1])) return null;
    const query = beforeCursor.slice(idx + 1);
    if (query.includes(" ")) return null;
    return { node: node as Text, startOffset: idx, query };
  }

  function createSkillChip(skill: SkillInfo): HTMLSpanElement {
    const chip = document.createElement("span");
    chip.setAttribute("contenteditable", "false");
    chip.dataset.skillId = skill.id;
    chip.dataset.skillSlash = skill.slash;
    chip.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "gap:3px",
      "padding:1px 7px",
      "margin:0 1px",
      "border-radius:5px",
      "background:color-mix(in srgb,var(--t-dot) 12%,transparent)",
      "border:1px solid color-mix(in srgb,var(--t-dot) 20%,transparent)",
      "color:var(--t-dot)",
      "font-size:11px",
      "font-weight:500",
      "vertical-align:baseline",
      "user-select:none",
      "line-height:1.5",
      "cursor:default",
    ].join(";");
    const iconEl = document.createElement("span");
    iconEl.textContent = getSkillIcon(skill.id);
    iconEl.style.fontSize = "10px";
    const labelEl = document.createElement("span");
    labelEl.textContent = skill.slash;
    labelEl.style.cssText =
      "font-family:var(--font-mono,monospace);letter-spacing:-0.02em";
    chip.appendChild(iconEl);
    chip.appendChild(labelEl);
    return chip;
  }

  function createFileChip(file: FileEntry): HTMLSpanElement {
    const chip = document.createElement("span");
    chip.setAttribute("contenteditable", "false");
    chip.dataset.fileKey = file.key;
    chip.dataset.fileLabel = file.shortLabel;
    chip.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "gap:3px",
      "padding:1px 7px",
      "margin:0 1px",
      "border-radius:5px",
      "background:color-mix(in srgb,var(--t-accent) 12%,transparent)",
      "border:1px solid color-mix(in srgb,var(--t-accent) 20%,transparent)",
      "color:var(--t-accent)",
      "font-size:11px",
      "font-weight:500",
      "vertical-align:baseline",
      "user-select:none",
      "line-height:1.5",
      "cursor:default",
    ].join(";");
    const atEl = document.createElement("span");
    atEl.textContent = "@";
    atEl.style.opacity = "0.6";
    const labelEl = document.createElement("span");
    labelEl.textContent = file.shortLabel;
    chip.appendChild(atEl);
    chip.appendChild(labelEl);
    return chip;
  }

  /** Insert a chip into the editor, replacing the trigger text. */
  function insertChipAtTrigger(
    trigger: { node: Text; startOffset: number; query: string },
    chip: HTMLSpanElement,
  ) {
    const editor = editorRef.current;
    if (!editor || !editor.contains(trigger.node)) return;

    const { node, startOffset, query } = trigger;
    const triggerEnd = Math.min(
      startOffset + 1 + query.length,
      (node.textContent || "").length,
    );

    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, triggerEnd);
    range.deleteContents();
    range.insertNode(chip);

    // Add space after chip and place cursor there
    const space = document.createTextNode("\u00A0");
    if (chip.nextSibling) {
      chip.parentNode!.insertBefore(space, chip.nextSibling);
    } else {
      chip.parentNode!.appendChild(space);
    }

    const newRange = document.createRange();
    newRange.setStart(space, 1);
    newRange.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    setEditorEmpty(false);
    editor.focus();
  }

  /* ── Trigger detection ── */

  function detectTriggers() {
    // Check "/" skill trigger first
    const slash = findTriggerAtCursor("/");
    if (slash) {
      slashTriggerRef.current = slash;
      setSkillQuery(slash.query);
      setShowSkillPicker(true);
      setShowFilePicker(false);
      atTriggerRef.current = null;
      return;
    }
    slashTriggerRef.current = null;
    setShowSkillPicker(false);
    setSkillQuery("");

    // Check "@" file trigger
    const at = findTriggerAtCursor("@");
    if (at) {
      atTriggerRef.current = at;
      setFileQuery(at.query);
      setShowFilePicker(true);
      return;
    }
    atTriggerRef.current = null;
    setShowFilePicker(false);
    setFileQuery("");
  }

  /* ── File attachment helpers ── */

  function addFiles(incoming: File[]) {
    setPendingFiles((prev) => {
      const combined = [...prev];
      for (const file of incoming) {
        if (combined.length >= MAX_ATTACHMENTS) break;
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) continue;
        if (isImage && file.size > MAX_IMAGE_SIZE) continue;
        if (isPdf && file.size > MAX_PDF_SIZE) continue;
        // Avoid duplicates by name+size
        if (combined.some((f) => f.name === file.name && f.size === file.size)) continue;
        combined.push(file);
      }
      return combined;
    });
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = ""; // reset so same file can be re-selected
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  /* ── Handlers ── */

  // Close pickers on outside click
  useEffect(() => {
    if (!showSkillPicker && !showFilePicker) return;
    function handleClick(e: MouseEvent) {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(e.target as Node)
      ) {
        setShowSkillPicker(false);
        setShowFilePicker(false);
        slashTriggerRef.current = null;
        atTriggerRef.current = null;
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSkillPicker, showFilePicker]);

  // Close filter panel on outside click
  useEffect(() => {
    if (!showFilterPanel) return;
    function handleClick(e: MouseEvent) {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setShowFilterPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFilterPanel]);

  function handleEditorInput() {
    setEditorEmpty(checkEditorEmpty());
    detectTriggers();
  }

  const handleSkillSelect = useCallback((slash: string) => {
    const skill = SKILL_LIST.find((s) => s.slash === slash);
    const trigger = slashTriggerRef.current;
    if (!skill || !trigger) return;

    const chip = createSkillChip(skill);
    insertChipAtTrigger(trigger, chip);

    slashTriggerRef.current = null;
    setShowSkillPicker(false);
    setSkillQuery("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkillClose = useCallback(() => {
    setShowSkillPicker(false);
    slashTriggerRef.current = null;
  }, []);

  const handleFileSelect = useCallback((file: FileEntry) => {
    const trigger = atTriggerRef.current;
    if (!trigger) return;

    const chip = createFileChip(file);
    insertChipAtTrigger(trigger, chip);

    atTriggerRef.current = null;
    setShowFilePicker(false);
    setFileQuery("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilePickerClose = useCallback(() => {
    setShowFilePicker(false);
    atTriggerRef.current = null;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentTyping]);

  function handleEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // When any picker is open, delegate navigation keys to it
    if (showSkillPicker || showFilePicker) {
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Enter" ||
        e.key === "Escape"
      ) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const text = serializeEditor();
    if ((!text && pendingFiles.length === 0) || agentTyping) return;
    const filesToSend = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    const editor = editorRef.current;
    if (editor) editor.innerHTML = "";
    setEditorEmpty(true);
    setPendingFiles([]);
    setShowSkillPicker(false);
    setShowFilePicker(false);
    slashTriggerRef.current = null;
    atTriggerRef.current = null;
    onSend(text, filesToSend);
  }

  function handleSuggestion(text: string) {
    if (agentTyping) return;
    onSend(text);
  }

  /* ── Collapsed rail ── */
  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-3">
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
          title="Expand chat"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !agentTyping;

  /* ── History panel view ── */
  if (showHistory) {
    return (
      <div className="h-full flex flex-col">
        {/* Header (same structure but with back button) */}
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
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Session list */}
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

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Dot indicator */}
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
          {/* History toggle */}
          <button
            onClick={onToggleHistory}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            title="Chat history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {/* New chat */}
          <button
            onClick={onNewSession}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          {/* Collapse */}
          <button
            onClick={onToggle}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            title="Collapse chat"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-dot/8 flex items-center justify-center mb-4">
              <svg
                className="w-5 h-5 text-dot"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
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

            {/* Suggested prompts */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestion(prompt)}
                  className="px-2.5 py-1.5 text-[11px] text-sub hover:text-heading bg-page/60 hover:bg-page border border-edge/30 hover:border-edge/50 rounded-lg transition-all cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onAcceptUpdate={
              onAcceptUpdate
                ? (updateId) => onAcceptUpdate(msg.id, updateId)
                : undefined
            }
            onRejectUpdate={
              onRejectUpdate
                ? (updateId) => onRejectUpdate(msg.id, updateId)
                : undefined
            }
            sourceFiles={sourceFiles}
            onSourceClick={onNavigateSource}
          />
        ))}

        {/* Standalone thinking indicator (before first streaming token) */}
        {agentTyping && !messages.some((m) => m.isStreaming) && (
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
        )}
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 border-t border-edge/30 p-3">
        <div ref={inputWrapperRef} className="relative">
          {/* Skill picker floats above */}
          {showSkillPicker && !showFilePicker && (
            <SkillPicker
              query={skillQuery}
              onSelect={handleSkillSelect}
              onClose={handleSkillClose}
            />
          )}

          {/* File mention picker floats above (mousedown prevented to keep editor focus) */}
          {showFilePicker && !showSkillPicker && (
            <div onMouseDown={(e) => e.preventDefault()} className="contents">
              <FileMentionPicker
                query={fileQuery}
                files={files}
                onSelect={handleFileSelect}
                onClose={handleFilePickerClose}
              />
            </div>
          )}

          {/* Filter panel popover */}
          {showFilterPanel && searchFilters !== undefined && onSearchFiltersChange && (
            <div
              ref={filterPanelRef}
              className="absolute bottom-full left-0 right-0 mb-2 glass-panel rounded-xl border border-edge/40 p-4 z-20 shadow-lg"
              style={{ backdropFilter: "blur(24px)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">
                  Search filters
                </span>
                <button
                  onClick={() => setShowFilterPanel(false)}
                  className="w-5 h-5 flex items-center justify-center rounded text-dim hover:text-sub transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SearchFilterPanel
                filters={searchFilters}
                onChange={onSearchFiltersChange}
                compact
              />
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div
            className={`glass-panel rounded-xl px-3 py-2.5 transition-colors ${isDragOver ? "ring-1 ring-accent-fill/40 bg-accent-fill/5" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Attachment preview strip */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pendingFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="group/att relative flex items-center gap-1 px-1.5 py-1 rounded-md bg-page/60 border border-edge/30">
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
                    <span className="text-[10px] text-sub truncate max-w-[80px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="opacity-0 group-hover/att:opacity-100 absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface border border-edge/40 flex items-center justify-center text-dim hover:text-heading transition-all cursor-pointer"
                    >
                      <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
            <div className="flex-1 relative min-w-0">
              {/* Placeholder */}
              {editorEmpty && pendingFiles.length === 0 && (
                <div className="absolute inset-0 flex items-center pointer-events-none text-[12.5px] text-mute leading-[1.5] select-none truncate">
                  Ask about your research... (@ to mention, / for skills)
                </div>
              )}
              {/* Rich editor with inline chips */}
              <div
                ref={editorRef}
                contentEditable={!agentTyping}
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onClick={detectTriggers}
                onPaste={(e) => {
                  // Check for pasted images
                  const items = e.clipboardData.items;
                  const imageFiles: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith("image/")) {
                      const file = items[i].getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    addFiles(imageFiles);
                    return;
                  }
                  // Default: paste as plain text
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }}
                role="textbox"
                aria-multiline
                aria-placeholder="Ask about your research..."
                className={`text-[12.5px] text-heading outline-none leading-[1.5] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words ${agentTyping ? "opacity-50 pointer-events-none" : ""}`}
                style={{ minHeight: "20px" }}
                suppressContentEditableWarning
              />
            </div>
            {/* Search filter toggle */}
            {onSearchFiltersChange && (
              <button
                onClick={() => setShowFilterPanel((v) => !v)}
                className={`relative w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0 ${
                  showFilterPanel || hasActiveSearchFilters(searchFilters)
                    ? "text-accent bg-accent-fill/12 hover:bg-accent-fill/20"
                    : "text-dim hover:text-sub hover:bg-page"
                }`}
                title="Search filters"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                {/* Active filter count badge */}
                {hasActiveSearchFilters(searchFilters) && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent text-on-accent text-[7px] font-bold flex items-center justify-center leading-none">
                    {countActiveSearchFilters(searchFilters)}
                  </span>
                )}
              </button>
            )}
            {/* Paperclip button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={agentTyping}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-dim hover:text-sub hover:bg-page transition-colors disabled:opacity-25 disabled:cursor-default cursor-pointer flex-shrink-0"
              title="Attach files"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={(editorEmpty && pendingFiles.length === 0) || agentTyping}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-fill/12 text-accent hover:bg-accent-fill/20 transition-colors disabled:opacity-25 disabled:cursor-default cursor-pointer flex-shrink-0"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
          </div>
        </div>
        <p className="text-[9.5px] text-mute text-center mt-1.5">
          Enter to send · Shift+Enter for new line · <span className="text-dim">@</span> mention · <span className="text-dim">/</span> skills · Paste or drop files
        </p>
      </div>
    </div>
  );
}

/* ── Search filter helpers ── */

function hasActiveSearchFilters(filters?: SearchFilterConfig): boolean {
  if (!filters) return false;
  return Boolean(
    filters.venues?.length ||
      (filters.publicationType && filters.publicationType !== "all") ||
      filters.minCitationCount ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.openAccessOnly
  );
}

function countActiveSearchFilters(filters?: SearchFilterConfig): number {
  if (!filters) return 0;
  let count = 0;
  if (filters.venues?.length) count++;
  if (filters.publicationType && filters.publicationType !== "all") count++;
  if (filters.minCitationCount) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  if (filters.openAccessOnly) count++;
  return count;
}
