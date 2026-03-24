"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { FileEntry } from "../../_lib/workspace-types";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import { SKILL_LIST } from "../../_lib/skill-definitions";
import { SearchFilterPanel } from "../../../_components/search-filter-panel";
import { SkillPicker } from "./skill-picker";
import { FileMentionPicker } from "./file-mention-picker";
import { ComposerAttachments } from "./composer-attachments";
import { createQuoteChip, createSkillChip, createMentionChip, insertChipAtTrigger } from "./composer/composer-chips";
import { serializeEditor as serializeEditorDOM, checkEditorEmpty as checkEditorEmptyDOM, findTriggerAtCursor } from "./composer/composer-serializer";
import { hasActiveSearchFilters, countActiveSearchFilters } from "./composer/composer-filter-utils";
import { ReasoningGlyph, REASONING_OPTIONS } from "./composer/reasoning-glyph";
import type { MentionEntry } from "./composer/mention-utils";

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.gif,.webp,.pdf";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

// ─── ChatComposer ─────────────────────────────────────────────────────────

export interface ChatComposerHandle {
  injectQuotedContext: (text: string, sourceLabel: string) => void;
}

export const ChatComposer = forwardRef<ChatComposerHandle, {
  agentTyping: boolean;
  files: FileEntry[];
  folderPaths?: string[];
  onSend: (text: string, attachments?: File[]) => void;
  searchFilters?: SearchFilterConfig;
  onSearchFiltersChange?: (filters: SearchFilterConfig) => void;
  autoAcceptEdits?: boolean;
  onAutoAcceptEditsChange?: () => void;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  onReasoningEffortChange?: (value: "low" | "medium" | "high" | "xhigh") => void;
}>(function ChatComposer({
  agentTyping,
  files,
  folderPaths = [],
  onSend,
  searchFilters,
  onSearchFiltersChange,
  autoAcceptEdits,
  onAutoAcceptEditsChange,
  reasoningEffort = "medium",
  onReasoningEffortChange,
}, ref) {
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showReasoningPanel, setShowReasoningPanel] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const reasoningPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const slashTriggerRef = useRef<{ node: Text; startOffset: number; query: string } | null>(null);
  const atTriggerRef = useRef<{ node: Text; startOffset: number; query: string } | null>(null);
  const selectedReasoningOption = useMemo(
    () =>
      REASONING_OPTIONS.find((option) => option.value === reasoningEffort) ??
      REASONING_OPTIONS[1],
    [reasoningEffort]
  );

  function injectQuotedContext(text: string, sourceLabel: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const chip = createQuoteChip(text, sourceLabel);
    editor.appendChild(chip);

    // Add a space after the chip so the cursor has somewhere to go
    const space = document.createTextNode("\u00A0");
    editor.appendChild(space);

    const range = document.createRange();
    range.setStart(space, 1);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    editor.focus();
    setEditorEmpty(false);
  }

  useImperativeHandle(ref, () => ({ injectQuotedContext }));

  function serializeEditor(): string {
    const editor = editorRef.current;
    if (!editor) return "";
    return serializeEditorDOM(editor);
  }

  function checkEditorEmpty(): boolean {
    const editor = editorRef.current;
    if (!editor) return true;
    return checkEditorEmptyDOM(editor);
  }

  function detectTriggers() {
    const editor = editorRef.current;
    if (!editor) return;

    const slash = findTriggerAtCursor(editor, "/");
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

    const at = findTriggerAtCursor(editor, "@");
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
        if (combined.some((entry) => entry.name === file.name && entry.size === file.size)) {
          continue;
        }
        combined.push(file);
      }
      return combined;
    });
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditorInput() {
    setEditorEmpty(checkEditorEmpty());
    detectTriggers();
  }

  const handleSkillSelect = useCallback((slash: string) => {
    const editor = editorRef.current;
    const skill = SKILL_LIST.find((entry) => entry.slash === slash);
    const trigger = slashTriggerRef.current;
    if (!skill || !trigger || !editor) return;

    const chip = createSkillChip(skill);
    insertChipAtTrigger(editor, trigger, chip);
    setEditorEmpty(false);

    slashTriggerRef.current = null;
    setShowSkillPicker(false);
    setSkillQuery("");
  }, []);

  const handleFileSelect = useCallback((entry: MentionEntry) => {
    const editor = editorRef.current;
    const trigger = atTriggerRef.current;
    if (!trigger || !editor) return;

    const chip = createMentionChip(entry);
    insertChipAtTrigger(editor, trigger, chip);
    setEditorEmpty(false);

    atTriggerRef.current = null;
    setShowFilePicker(false);
    setFileQuery("");
  }, []);

  useEffect(() => {
    if (!showSkillPicker && !showFilePicker) return;

    function handleClick(e: MouseEvent) {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowSkillPicker(false);
        setShowFilePicker(false);
        slashTriggerRef.current = null;
        atTriggerRef.current = null;
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSkillPicker, showFilePicker]);

  useEffect(() => {
    if (!showFilterPanel) return;

    function handleClick(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFilterPanel]);

  useEffect(() => {
    if (!showReasoningPanel) return;

    function handleClick(e: MouseEvent) {
      if (
        reasoningPanelRef.current &&
        !reasoningPanelRef.current.contains(e.target as Node)
      ) {
        setShowReasoningPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showReasoningPanel]);

  function handleEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
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

  return (
    <div className="flex-shrink-0 p-3 pt-2">
      <div ref={inputWrapperRef} className="relative">
        {/* Floating pickers */}
        {showSkillPicker && !showFilePicker && (
          <SkillPicker
            query={skillQuery}
            onSelect={handleSkillSelect}
            onClose={() => {
              setShowSkillPicker(false);
              slashTriggerRef.current = null;
            }}
          />
        )}

        {showFilePicker && !showSkillPicker && (
          <div onMouseDown={(e) => e.preventDefault()} className="contents">
            <FileMentionPicker
              query={fileQuery}
              files={files}
              folderPaths={folderPaths}
              onSelect={handleFileSelect}
              onClose={() => {
                setShowFilePicker(false);
                atTriggerRef.current = null;
              }}
            />
          </div>
        )}

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
            <SearchFilterPanel filters={searchFilters} onChange={onSearchFiltersChange} compact />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />

        {/* ── Main composer container ── */}
        <div
          className={`glass-panel rounded-xl border border-edge/30 transition-all ${
            isDragOver
              ? "ring-1 ring-accent-fill/40 border-accent-fill/30 bg-accent-fill/5"
              : "hover:border-edge/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Top row — Editor area */}
          <div className="px-3.5 pt-3 pb-2">
            <ComposerAttachments files={pendingFiles} onRemove={removeFile} />
            <div className="relative min-w-0">
              {editorEmpty && pendingFiles.length === 0 && (
                <div className="absolute inset-0 flex items-start pointer-events-none text-[12.5px] text-mute leading-[1.5] select-none">
                  Ask anything, @ for context, / for skills
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onClick={detectTriggers}
                onPaste={(e) => {
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
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }}
                role="textbox"
                aria-multiline
                aria-placeholder="Ask anything, @ for context, / for skills"
                className="text-[12.5px] text-heading outline-none leading-[1.5] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words"
                style={{ minHeight: "20px" }}
                suppressContentEditableWarning
              />
            </div>
          </div>

          {/* Bottom row — Toolbar */}
          <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-0.5">
            {onReasoningEffortChange ? (
              <div ref={reasoningPanelRef} className="relative flex-shrink-0">
                {showReasoningPanel && (
                  <div
                    role="menu"
                    aria-label="Select reasoning"
                    className="absolute bottom-full left-0 mb-2 w-[252px] overflow-hidden rounded-[24px] border border-edge/35 z-20"
                    style={{
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, white 10%, var(--t-panel) 62%), color-mix(in srgb, var(--t-panel) 74%, transparent))",
                      boxShadow:
                        "0 20px 48px color-mix(in srgb, var(--t-shadow) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(255,255,255,0.04)",
                      backdropFilter: "blur(28px) saturate(145%)",
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-4 top-[1px] h-[1px] rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.36), transparent)",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute -left-6 top-5 h-24 w-24 rounded-full opacity-55 blur-2xl"
                      style={{
                        background:
                          "radial-gradient(circle, color-mix(in srgb, white 16%, var(--t-accent)) 0%, transparent 72%)",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute bottom-0 right-0 h-28 w-32 rounded-full opacity-38 blur-3xl"
                      style={{
                        background:
                          "radial-gradient(circle, color-mix(in srgb, white 8%, var(--t-dot)) 0%, transparent 74%)",
                      }}
                    />
                    <div className="relative z-10 px-4 pt-3 pb-2">
                      <div className="text-[11px] font-medium tracking-[0.01em] text-dim">
                        Select reasoning
                      </div>
                      <div className="mt-1 text-[10px] text-mute">
                        Faster at the top, deeper at the bottom.
                      </div>
                    </div>
                    <div className="relative z-10 px-2 pb-2">
                      {REASONING_OPTIONS.map((option) => {
                        const selected = option.value === reasoningEffort;
                        return (
                          <button
                            key={option.value}
                            role="menuitemradio"
                            aria-checked={selected}
                            onClick={() => {
                              onReasoningEffortChange(option.value);
                              setShowReasoningPanel(false);
                            }}
                            className={`group relative flex w-full items-center gap-2.5 overflow-hidden rounded-[17px] border px-2.5 py-2 text-left transition-all duration-200 cursor-pointer ${
                              selected
                                ? "border-edge/35 text-heading"
                                : "border-transparent text-sub hover:border-edge/25 hover:text-heading"
                            }`}
                            style={{
                              background: selected
                                ? "linear-gradient(180deg, color-mix(in srgb, white 10%, transparent), color-mix(in srgb, var(--t-panel) 54%, transparent))"
                                : "linear-gradient(180deg, transparent, color-mix(in srgb, white 1%, transparent))",
                              boxShadow: selected
                                ? "inset 0 1px 0 rgba(255,255,255,0.12)"
                                : "none",
                            }}
                          >
                            <span
                              className={`pointer-events-none absolute inset-x-3 top-[1px] h-[1px] rounded-full transition-opacity ${
                                selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                              }`}
                              style={{
                                background:
                                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
                              }}
                            />
                            <ReasoningGlyph active={selected} />
                            <span className="min-w-0 flex-1 font-sans text-[12px] font-medium">
                              {option.label}
                            </span>
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                                selected
                                  ? "bg-page/55 text-heading shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                                  : "bg-transparent text-transparent"
                              }`}
                              style={
                                selected
                                  ? {
                                      border:
                                        "1px solid color-mix(in srgb, white 18%, var(--t-edge))",
                                    }
                                  : undefined
                              }
                            >
                              {selected ? (
                                <svg
                                  className="h-3.5 w-3.5"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5l2.5 2.5 6-6" />
                                </svg>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowFilterPanel(false);
                    setShowReasoningPanel((value) => !value);
                  }}
                  className={`group relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-full border px-3 text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                    showReasoningPanel
                      ? "border-edge/45 text-heading"
                      : "border-edge/25 text-sub hover:border-edge/45 hover:text-heading"
                  }`}
                  style={{
                    background: showReasoningPanel
                      ? "linear-gradient(180deg, color-mix(in srgb, white 11%, var(--t-panel)), color-mix(in srgb, var(--t-panel) 70%, transparent))"
                      : "linear-gradient(180deg, color-mix(in srgb, white 5%, var(--t-panel)), color-mix(in srgb, var(--t-panel) 58%, transparent))",
                    boxShadow: showReasoningPanel
                      ? "0 10px 24px color-mix(in srgb, var(--t-shadow) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)"
                      : "inset 0 1px 0 rgba(255,255,255,0.1)",
                    backdropFilter: "blur(16px) saturate(135%)",
                  }}
                  aria-haspopup="menu"
                  aria-expanded={showReasoningPanel}
                  aria-label={`Reasoning level: ${selectedReasoningOption.label}`}
                >
                  <span
                    className="pointer-events-none absolute inset-x-4 top-[1px] h-[1px] rounded-full opacity-80"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.26), transparent)",
                    }}
                  />
                  <span
                    className={`pointer-events-none absolute -left-2 top-0 h-8 w-16 rounded-full blur-xl transition-opacity ${
                      showReasoningPanel ? "opacity-58" : "opacity-38 group-hover:opacity-52"
                    }`}
                    style={{
                      background:
                        "radial-gradient(circle, color-mix(in srgb, white 14%, var(--t-accent)) 0%, transparent 72%)",
                    }}
                  />
                  <span className="text-inherit">{selectedReasoningOption.label}</span>
                  <svg
                    className={`relative h-3.5 w-3.5 transition-transform ${showReasoningPanel ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 7.75L10 12.25l4.5-4.5" />
                  </svg>
                </button>
              </div>
            ) : (
              <div />
            )}

            {/* Right — Action buttons */}
            <div className="flex items-center gap-0.5">
              {onAutoAcceptEditsChange && (
                <div className="group/tip relative">
                  <button
                    onClick={onAutoAcceptEditsChange}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                      autoAcceptEdits
                        ? "text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/20"
                        : "text-mute hover:text-sub hover:bg-page/80"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-panel border border-edge/40 text-sub text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 shadow-sm z-20">
                    {autoAcceptEdits ? "Auto-accept edits: ON" : "Auto-accept edits: OFF"}
                  </span>
                </div>
              )}

              {onSearchFiltersChange && (
                <div className="group/tip relative">
                  <button
                    onClick={() => {
                      setShowReasoningPanel(false);
                      setShowFilterPanel((v) => !v);
                    }}
                    className={`relative w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                      showFilterPanel || hasActiveSearchFilters(searchFilters)
                        ? "text-accent bg-accent-fill/12 hover:bg-accent-fill/20"
                        : "text-mute hover:text-sub hover:bg-page/80"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                    {hasActiveSearchFilters(searchFilters) && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent text-on-accent text-[7px] font-bold flex items-center justify-center leading-none">
                        {countActiveSearchFilters(searchFilters)}
                      </span>
                    )}
                  </button>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-panel border border-edge/40 text-sub text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 shadow-sm z-20">
                    Search filters
                  </span>
                </div>
              )}

              <div className="group/tip relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-mute hover:text-sub hover:bg-page/80 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-panel border border-edge/40 text-sub text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 shadow-sm z-20">
                  Attach files
                </span>
              </div>

              <button
                onClick={handleSend}
                disabled={(editorEmpty && pendingFiles.length === 0) || agentTyping}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-fill/12 text-accent hover:bg-accent-fill/20 transition-colors disabled:opacity-25 disabled:cursor-default cursor-pointer flex-shrink-0 ml-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
