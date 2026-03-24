import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import type { ReasoningEffort } from "@/lib/llm/types";
import type { TaskState } from "@/lib/agent/state";

export type ChatReasoningEffort = Exclude<ReasoningEffort, "none">;

function parseStoredReasoningEffort(
  value: string | null
): ChatReasoningEffort {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh"
    ? value
    : "medium";
}

export function useWorkspaceUI() {
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Search filter state
  const [searchFilters, setSearchFilters] = useState<SearchFilterConfig>({});

  // Auto-accept edits toggle
  const [autoAcceptEdits, setAutoAcceptEdits] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("autoAcceptEdits") === "true";
    }
    return false;
  });
  const [reasoningEffort, setReasoningEffort] =
    useState<ChatReasoningEffort>(() => {
      if (typeof window !== "undefined") {
        return parseStoredReasoningEffort(
          localStorage.getItem("chatReasoningEffort")
        );
      }
      return "medium";
    });
  const autoAcceptEditsRef = useRef(autoAcceptEdits);
  useEffect(() => {
    autoAcceptEditsRef.current = autoAcceptEdits;
  }, [autoAcceptEdits]);

  const toggleAutoAcceptEdits = useCallback(() => {
    setAutoAcceptEdits((prev) => {
      const next = !prev;
      localStorage.setItem("autoAcceptEdits", String(next));
      return next;
    });
  }, []);

  const updateReasoningEffort = useCallback((next: ChatReasoningEffort) => {
    setReasoningEffort(next);
    localStorage.setItem("chatReasoningEffort", next);
  }, []);

  // Task plan state
  const [activeTaskPlan, setActiveTaskPlan] = useState<TaskState[] | null>(null);
  const dismissTaskPlan = useCallback(() => setActiveTaskPlan(null), []);

  const toggleChat = useCallback(
    () => setChatCollapsed((prev) => !prev),
    []
  );
  const toggleSidebar = useCallback(
    () => setSidebarCollapsed((prev) => !prev),
    []
  );
  const toggleExpanded = useCallback(
    () => setExpanded((prev) => !prev),
    []
  );

  return {
    chatCollapsed,
    sidebarCollapsed,
    expanded,
    searchFilters,
    setSearchFilters,
    autoAcceptEdits,
    autoAcceptEditsRef,
    reasoningEffort,
    toggleAutoAcceptEdits,
    updateReasoningEffort,
    activeTaskPlan,
    setActiveTaskPlan,
    dismissTaskPlan,
    toggleChat,
    toggleSidebar,
    toggleExpanded,
  };
}
