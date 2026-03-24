/** Pure DOM functions for serializing and inspecting the contenteditable editor. */

/** Serialize the editor DOM into a plain text string, handling chips specially. */
export function serializeEditor(editor: HTMLDivElement): string {
  let result = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node instanceof HTMLElement) {
      if (node.dataset.quotedContext) {
        const fullText = node.dataset.fullText || "";
        const sourceLabel = node.dataset.sourceLabel || "";
        result += `> "${fullText}"\n> \u2014 ${sourceLabel}\n\n`;
        return;
      } else if (node.dataset.mentionToken) {
        result += node.dataset.mentionToken;
        return;
      } else if (node.dataset.skillSlash) {
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

/** Check whether the editor is empty (no text, no chips). */
export function checkEditorEmpty(editor: HTMLDivElement): boolean {
  const hasChips =
    editor.querySelectorAll("[data-skill-slash],[data-file-key],[data-folder-path],[data-mention-token],[data-quoted-context]").length > 0;
  const text = (editor.textContent || "")
    .replace(/\u200B/g, "")
    .replace(/\u00A0/g, "")
    .trim();
  return !hasChips && text === "";
}

/** Find a trigger character (e.g. "/" or "@") at the cursor position in the editor. */
export function findTriggerAtCursor(
  editor: HTMLDivElement,
  char: string
): { node: Text; startOffset: number; query: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
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
