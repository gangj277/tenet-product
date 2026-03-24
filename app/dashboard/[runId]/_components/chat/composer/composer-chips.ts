/** Pure DOM factory functions for creating contenteditable chip elements. */

import type { SkillInfo } from "../../../_lib/skill-definitions";
import type { FileEntry } from "../../../_lib/workspace-types";
import type { FolderMentionEntry, MentionEntry } from "./mention-utils";

const SKILL_ICONS: Record<string, string> = {
  "compact-context": "\u25CC",
  "devils-advocate": "\u2694",
  "source-scout": "\u2609",
  "paper-explainer": "\u273F",
  "evidence-adjudicator": "\u2696",
  "synthesis-updater": "\u2B21",
  "methodology-critic": "\u2662",
};

export function getSkillIcon(id: string): string {
  return SKILL_ICONS[id] ?? "\u2726";
}

export function createQuoteChip(text: string, sourceLabel: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute("contenteditable", "false");
  chip.dataset.quotedContext = "true";
  chip.dataset.fullText = text;
  chip.dataset.sourceLabel = sourceLabel;

  const preview = text.length > 40 ? text.slice(0, 38) + "\u2026" : text;

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
    "max-width:260px",
  ].join(";");

  const iconEl = document.createElement("span");
  iconEl.textContent = "\u201C";
  iconEl.style.cssText = "font-size:13px;flex-shrink:0;opacity:0.7";

  const labelEl = document.createElement("span");
  labelEl.textContent = `${preview}\u201D \u2014 ${sourceLabel}`;
  labelEl.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

  chip.appendChild(iconEl);
  chip.appendChild(labelEl);
  return chip;
}

export function createSkillChip(skill: SkillInfo): HTMLSpanElement {
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

export function createFileChip(file: FileEntry): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute("contenteditable", "false");
  chip.dataset.fileKey = file.key;
  chip.dataset.fileLabel = file.shortLabel;
  chip.dataset.mentionToken = `@${file.key}`;
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

export function createFolderChip(folder: FolderMentionEntry): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute("contenteditable", "false");
  chip.dataset.folderPath = folder.path;
  chip.dataset.folderLabel = folder.label;
  chip.dataset.mentionToken = folder.mentionToken;
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
  const atEl = document.createElement("span");
  atEl.textContent = "@";
  atEl.style.opacity = "0.6";
  const labelEl = document.createElement("span");
  labelEl.textContent = folder.label;
  chip.appendChild(atEl);
  chip.appendChild(labelEl);
  return chip;
}

export function createMentionChip(entry: MentionEntry): HTMLSpanElement {
  return entry.type === "file"
    ? createFileChip({
        key: entry.key,
        label: entry.label,
        shortLabel: entry.shortLabel,
        icon: entry.icon,
        group: entry.group,
      } as FileEntry)
    : createFolderChip(entry);
}

/** Insert a chip at a trigger position in the editor, replacing the trigger text. */
export function insertChipAtTrigger(
  editor: HTMLDivElement,
  trigger: { node: Text; startOffset: number; query: string },
  chip: HTMLSpanElement
) {
  if (!editor.contains(trigger.node)) return;

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

  editor.focus();
}
