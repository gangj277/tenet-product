import { useCallback, useEffect, useRef, useState } from "react";

interface TextSelectionState {
  text: string;
  rect: DOMRect | null;
  visible: boolean;
}

const MIN_SELECTION_LENGTH = 3;

export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>
): TextSelectionState {
  const [state, setState] = useState<TextSelectionState>({
    text: "",
    rect: null,
    visible: false,
  });
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setState({ text: "", rect: null, visible: false });
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setState({ text: "", rect: null, visible: false });
      return;
    }

    const range = sel.getRangeAt(0);

    // Ensure selection is within our container
    if (!container.contains(range.commonAncestorContainer)) {
      setState({ text: "", rect: null, visible: false });
      return;
    }

    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) {
      setState({ text: "", rect: null, visible: false });
      return;
    }

    const rect = range.getBoundingClientRect();
    setState({ text, rect, visible: true });
  }, [containerRef]);

  useEffect(() => {
    const handler = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
      cancelAnimationFrame(rafRef.current);
    };
  }, [update]);

  return state;
}
