"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { FileEntry } from "../../_lib/workspace-types";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import { SKILL_LIST, type SkillInfo } from "../../_lib/skill-definitions";
import { SearchFilterPanel } from "../../../_components/search-filter-panel";
import { SkillPicker } from "./skill-picker";
import { FileMentionPicker } from "./file-mention-picker";
import { ComposerAttachments } from "./composer-attachments";

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.gif,.webp,.pdf";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_SIZE = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

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

// ─── Model Picker ─────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  tier: string;
  cost: string;
  icon: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash", tier: "Fast", cost: "$", icon: "⚡" },
  { id: "google/gemini-3.1-pro", label: "Gemini Pro", tier: "Pro", cost: "$$", icon: "◆" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", tier: "Premium", cost: "$$$", icon: "◉" },
];

function ModelPicker({
  selectedModel,
  onModelChange,
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const current = MODEL_OPTIONS.find((m) => m.id === selectedModel) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={pickerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-[26px] px-2 rounded-md bg-page/60 hover:bg-page border border-edge/30 hover:border-edge/50 transition-all cursor-pointer group"
      >
        <span className="text-[11px] text-dim group-hover:text-sub transition-colors">{current.icon}</span>
        <span className="text-[11px] font-medium text-sub group-hover:text-heading transition-colors">
          {current.label}
        </span>
        <svg className="w-2.5 h-2.5 text-mute" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1.5 w-[220px] glass-panel rounded-lg border border-edge/40 py-1 z-30 shadow-xl"
          style={{ backdropFilter: "blur(24px)" }}
        >
          <div className="px-2.5 py-1.5 mb-0.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">
              Agent Model
            </span>
          </div>
          {MODEL_OPTIONS.map((model) => {
            const isActive = model.id === selectedModel;
            return (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? "bg-accent-fill/8 text-heading"
                    : "text-sub hover:bg-page/80 hover:text-heading"
                }`}
              >
                <span className="w-4 text-center text-[12px] flex-shrink-0">{model.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-medium truncate">{model.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1 py-[1px] rounded ${
                      model.tier === "Fast"
                        ? "text-emerald-400/90 bg-emerald-500/10"
                        : model.tier === "Pro"
                          ? "text-sky-400/90 bg-sky-500/10"
                          : "text-amber-400/90 bg-amber-500/10"
                    }`}>
                      {model.tier}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-mute font-mono flex-shrink-0">{model.cost}</span>
                {isActive && (
                  <svg className="w-3 h-3 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ChatComposer ─────────────────────────────────────────────────────────

export function ChatComposer({
  agentTyping,
  files,
  onSend,
  searchFilters,
  onSearchFiltersChange,
  autoAcceptEdits,
  onAutoAcceptEditsChange,
  selectedModel,
  onModelChange,
}: {
  agentTyping: boolean;
  files: FileEntry[];
  onSend: (text: string, attachments?: File[]) => void;
  searchFilters?: SearchFilterConfig;
  onSearchFiltersChange?: (filters: SearchFilterConfig) => void;
  autoAcceptEdits?: boolean;
  onAutoAcceptEditsChange?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}) {
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const slashTriggerRef = useRef<{ node: Text; startOffset: number; query: string } | null>(null);
  const atTriggerRef = useRef<{ node: Text; startOffset: number; query: string } | null>(null);

  const filteredFiles = useMemo(() => files, [files]);

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
    char: string
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

  function insertChipAtTrigger(
    trigger: { node: Text; startOffset: number; query: string },
    chip: HTMLSpanElement
  ) {
    const editor = editorRef.current;
    if (!editor || !editor.contains(trigger.node)) return;

    const { node, startOffset, query } = trigger;
    const triggerEnd = Math.min(
      startOffset + 1 + query.length,
      (node.textContent || "").length
    );

    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, triggerEnd);
    range.deleteContents();
    range.insertNode(chip);

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

  function detectTriggers() {
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
    const skill = SKILL_LIST.find((entry) => entry.slash === slash);
    const trigger = slashTriggerRef.current;
    if (!skill || !trigger) return;

    const chip = createSkillChip(skill);
    insertChipAtTrigger(trigger, chip);

    slashTriggerRef.current = null;
    setShowSkillPicker(false);
    setSkillQuery("");
  }, []);

  const handleFileSelect = useCallback((file: FileEntry) => {
    const trigger = atTriggerRef.current;
    if (!trigger) return;

    const chip = createFileChip(file);
    insertChipAtTrigger(trigger, chip);

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
              files={filteredFiles}
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
          <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
            {/* Left — Model picker */}
            <div className="flex items-center gap-1.5">
              {selectedModel && onModelChange && (
                <ModelPicker
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                />
              )}
            </div>

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
                    onClick={() => setShowFilterPanel((v) => !v)}
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
}
