import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Artifacts } from "@/lib/engine/state";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import type { ExperimentMeta, NoteMeta, SourceMeta } from "@/lib/db/research-projects";
import type { LineRange } from "../../_lib/citation-utils";
import type {
  AgentContinuationState,
  AskUserQuestion,
  TaskState,
  TokenUsage,
} from "@/lib/agent/state";
import {
  buildConversationHistoryFromMessages,
  deriveChatContinuationState,
  estimateLiveContextUsage,
  isCompactCommand,
  resolveDisplayedChatUsage,
} from "@/lib/agent/chat-context";
import { useWorkspaceUI } from "./use-workspace-ui";
import {
  buildFileList,
  collectFolderPaths,
  getArtifactContent,
  resolveActiveFileKey,
  truncateSourceName,
  type ChatAskUserQuestion,
  type ChatAttachmentInfo,
  type ChatMessage,
  type ChatUsageState,
  type FileEntry,
  type ProposedUpdate,
  type SessionSummary,
} from "../_lib/workspace-types";
import {
  completeActiveProcessTrace,
  failActiveProcessTrace,
  recordProcessActivity,
  recordToolCallTrace,
} from "../_lib/agent-process-trace";
import {
  buildPersistedMessageMetadata,
  hydrateStoredChatMessage,
} from "../_lib/chat-message-metadata";
import {
  acceptProposedUpdateInMessages,
  updateProposedUpdateStatusInMessages,
} from "../_lib/proposed-update-acceptance";

export function useWorkspace(runId: string) {
  const {
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
  } = useWorkspaceUI();

  const [artifacts, setArtifacts] = useState<Artifacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [noteFolderPaths, setNoteFolderPaths] = useState<string[]>([]);
  const [activeFileKey, setActiveFileKey] = useState<string>("");
  const [pendingLineRange, setPendingLineRange] = useState<LineRange | null>(null);
  const [editedContents, setEditedContents] = useState<Map<string, string>>(
    () => new Map()
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [agentTyping, setAgentTyping] = useState(false);

  // Session state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [compactionStatus, setCompactionStatus] =
    useState<ChatUsageState["compactionStatus"]>("idle");
  const [lastProviderUsage, setLastProviderUsage] =
    useState<TokenUsage | null>(null);
  const compactPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active task plan (lifted from per-message to top-level for persistent panel)
  // activeTaskPlan, dismissTaskPlan provided by useWorkspaceUI

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirtyKeysRef = useRef(new Set<string>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editedRef = useRef(new Map<string, string>());

  const artifactsRef = useRef<Artifacts | null>(null);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const notesMetaRef = useRef<Record<string, NoteMeta>>({});
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(
    () => () => {
      if (compactPulseTimeoutRef.current) {
        clearTimeout(compactPulseTimeoutRef.current);
      }
    },
    []
  );

  const folderPaths = useMemo(
    () => collectFolderPaths(files, noteFolderPaths),
    [files, noteFolderPaths]
  );

  const pulseCompactionStatus = useCallback(() => {
    setCompactionStatus("recently_compacted");
    if (compactPulseTimeoutRef.current) {
      clearTimeout(compactPulseTimeoutRef.current);
    }
    compactPulseTimeoutRef.current = setTimeout(
      () => setCompactionStatus("idle"),
      4000
    );
  }, []);

  const replaceChatMessages = useCallback((nextMessages: ChatMessage[]) => {
    chatMessagesRef.current = nextMessages;
    setChatMessages(nextMessages);
  }, []);

  const updateChatMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setChatMessages((prev) => {
        const nextMessages = updater(prev);
        chatMessagesRef.current = nextMessages;
        return nextMessages;
      });
    },
    []
  );

  const persistMessageMetadata = useCallback(
    (message: ChatMessage) => {
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) return;

      const metadata = buildPersistedMessageMetadata(message);
      if (Object.keys(metadata).length === 0) return;

      fetch(`/api/agent/${runId}/sessions/${sessionId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          metadata,
        }),
      }).catch(() => {});
    },
    [runId]
  );

  const refreshArtifacts = useCallback(
    async ({ initial = false }: { initial?: boolean } = {}) => {
      if (initial) {
        setLoading(true);
      }

      const res = await fetch(`/api/init/${runId}/artifacts`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load results (HTTP ${res.status})`);
      }

      const data = await res.json();
      const nextArtifacts = data.artifacts as Artifacts;
      if (!nextArtifacts.notes) nextArtifacts.notes = {};
      if (!nextArtifacts.experiments) nextArtifacts.experiments = {};

      const meta = (data.sourcesMeta ?? {}) as Record<string, SourceMeta>;
      const nMeta = (data.notesMeta ?? {}) as Record<string, NoteMeta>;
      const eMeta = (data.experimentsMeta ?? {}) as Record<string, ExperimentMeta>;
      const fileList = buildFileList(nextArtifacts, meta, nMeta, eMeta);

      artifactsRef.current = nextArtifacts;
      notesMetaRef.current = nMeta;
      setArtifacts(nextArtifacts);
      setFiles(fileList);
      setActiveFileKey((current) => resolveActiveFileKey(fileList, current));
      setError(null);
      setLoading(false);

      return {
        artifacts: nextArtifacts,
        files: fileList,
        sourcesMeta: meta,
        notesMeta: nMeta,
        experimentsMeta: eMeta,
      };
    },
    [runId]
  );

  // Fetch artifacts
  useEffect(() => {
    let cancelled = false;

    void refreshArtifacts({ initial: true }).catch((err) => {
      if (!cancelled) {
        setError((err as Error).message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshArtifacts]);

  // ── Session helpers ──

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/agent/${runId}/sessions`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
      return data.sessions as SessionSummary[];
    } catch {
      // silently fail — sessions are non-critical
    } finally {
      setSessionsLoading(false);
    }
  }, [runId]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(
          `/api/agent/${runId}/sessions/${sessionId}/`
        );
        if (!res.ok) return;
        const data = await res.json();
        const messages: ChatMessage[] = (data.messages ?? []).map(
          (m: {
            id: string;
            role: "user" | "agent";
            text: string;
            metadata: Record<string, unknown> | null;
            createdAt: string;
          }) => hydrateStoredChatMessage(m)
        );
        const continuation = deriveChatContinuationState(messages);
        const latestProviderUsage =
          [...messages].reverse().find((message) => message.providerUsage)
            ?.providerUsage ?? null;
        replaceChatMessages(messages);
        setLastProviderUsage(latestProviderUsage);
        setActiveTaskPlan(continuation.taskPlan?.tasks ?? null);
        setActiveSessionId(sessionId);
        setShowHistory(false);
      } catch {
        // silently fail
      }
    },
    [replaceChatMessages, runId]
  );

  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/${runId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setActiveSessionId(data.id);
      replaceChatMessages([]);
      setLastProviderUsage(null);
      setActiveTaskPlan(null);
      setShowHistory(false);
      // Refresh session list
      fetchSessions();
      return data as { id: string; title: string | null };
    } catch {
      return null;
    }
  }, [fetchSessions, replaceChatMessages, runId]);

  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      try {
        await fetch(`/api/agent/${runId}/sessions/${sessionId}`, {
          method: "DELETE",
        });
        // If we deleted the active session, clear messages
        if (activeSessionIdRef.current === sessionId) {
          setActiveSessionId(null);
          replaceChatMessages([]);
          setLastProviderUsage(null);
        }
        // Refresh list
        fetchSessions();
      } catch {
        // silently fail
      }
    },
    [fetchSessions, replaceChatMessages, runId]
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await fetch(`/api/agent/${runId}/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        // Optimistically update local state
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      } catch {
        // silently fail
      }
    },
    [runId]
  );

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  // Fetch sessions on mount and auto-load most recent
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const sessionsData = await fetchSessions();
      if (cancelled || !sessionsData) return;
      if (sessionsData.length > 0) {
        await loadSession(sessionsData[0].id);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const getContent = useCallback(
    (key: string): string => {
      if (editedContents.has(key)) {
        return editedContents.get(key)!;
      }
      if (!artifacts) return "";
      return getArtifactContent(artifacts, key);
    },
    [artifacts, editedContents]
  );

  // ── Auto-save: flush dirty edits to server ──

  const flushSave = useCallback(async () => {
    const dirty = new Set(dirtyKeysRef.current);
    if (dirty.size === 0) return;
    dirtyKeysRef.current.clear();

    const edits: Record<string, string> = {};
    for (const key of dirty) {
      const content = editedRef.current.get(key);
      if (content !== undefined) edits[key] = content;
    }
    if (Object.keys(edits).length === 0) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/init/${runId}/artifacts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      if (!res.ok) throw new Error();

      // Update the in-memory artifacts to match saved state
      setArtifacts((prev) => {
        if (!prev) return prev;
        const next = { ...prev, sources: { ...prev.sources }, papers: { ...(prev.papers || {}) }, notes: { ...(prev.notes || {}) }, experiments: { ...(prev.experiments || {}) } };
        for (const [key, content] of Object.entries(edits)) {
          if (key.startsWith("paper:")) {
            next.papers[key.slice(6)] = content;
          } else if (key.startsWith("note:")) {
            next.notes[key.slice(5)] = content;
          } else if (key.startsWith("experiment:")) {
            next.experiments[key.slice(11)] = content;
          } else if (key.startsWith("source:")) {
            next.sources[key.slice(7)] = content;
          } else if (key in next) {
            (next as Record<string, unknown>)[key] = content;
          }
        }
        artifactsRef.current = next;
        return next;
      });

      setSaveStatus("saved");
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
      savedIndicatorRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      // Re-mark as dirty so the next edit triggers a retry
      for (const key of dirty) dirtyKeysRef.current.add(key);
    }
  }, [runId]);

  const updateContent = useCallback(
    (key: string, md: string) => {
      setEditedContents((prev) => {
        const next = new Map(prev);
        next.set(key, md);
        return next;
      });
      editedRef.current.set(key, md);

      // Mark dirty and (re)start 2-second debounce
      dirtyKeysRef.current.add(key);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushSave, 2000);
    },
    [flushSave]
  );

  // Flush pending saves on unmount & beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dirtyKeysRef.current.size === 0) return;
      const edits: Record<string, string> = {};
      for (const key of dirtyKeysRef.current) {
        const content = editedRef.current.get(key);
        if (content !== undefined) edits[key] = content;
      }
      if (Object.keys(edits).length > 0) {
        fetch(`/api/init/${runId}/artifacts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edits }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
      // Fire-and-forget flush on unmount (e.g. navigating away within the SPA)
      handleBeforeUnload();
    };
  }, [runId]);

  const createFolder = useCallback((path: string) => {
    setNoteFolderPaths((prev) => collectFolderPaths([], [...prev, path]));
  }, []);

  const deleteFolder = useCallback((path: string) => {
    setNoteFolderPaths((prev) =>
      prev.filter((existing) => existing !== path && !existing.startsWith(`${path}/`))
    );
  }, []);

  const persistGeneratedNote = useCallback(
    (update: ProposedUpdate) => {
      if (!update.key.startsWith("note:")) return;

      const noteId = update.key.slice(5);
      const label = update.label || "Untitled Note";

      void fetch(`/api/init/${runId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: noteId,
          label,
          folder: update.folder || undefined,
          content: update.content,
        }),
      })
        .then((res) => {
          if (res.ok) return;
          return fetch(`/api/init/${runId}/notes/${noteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label,
              folder: update.folder ?? null,
            }),
          }).then(() => undefined);
        })
        .catch(() => {});
    },
    [runId]
  );

  // Auto-apply new files/papers/notes without user approval
  const autoApplyNewUpdate = useCallback(
    (update: ProposedUpdate) => {
      updateContent(update.key, update.content);

      // Add paper to sidebar
      if (update.key.startsWith("paper:")) {
        const titleMatch = update.content.match(/\\title\{([^}]+)\}/);
        const label = titleMatch?.[1]?.replace(/\\\\$/g, "").trim() || update.label || "Untitled Paper";

        const newFile: FileEntry = {
          key: update.key,
          label,
          shortLabel: truncateSourceName(label),
          icon: "paper",
          group: "paper",
          fileType: "latex",
        };

        setFiles((prev) => {
          if (prev.some((f) => f.key === newFile.key)) return prev;
          return [...prev, newFile];
        });
        setActiveFileKey(update.key);
      }

      // Add note to sidebar
      if (update.key.startsWith("note:")) {
        const label = update.label || "Untitled Note";
        const newFile: FileEntry = {
          key: update.key,
          label,
          shortLabel: truncateSourceName(label),
          icon: "note",
          group: "note",
          ...(update.folder ? { folder: update.folder } : {}),
        };

        setFiles((prev) => {
          if (prev.some((f) => f.key === newFile.key)) return prev;
          return [...prev, newFile];
        });
        if (update.folder) {
          setNoteFolderPaths((prev) => collectFolderPaths([], [...prev, update.folder!]));
        }
        persistGeneratedNote(update);
        setActiveFileKey(update.key);
      }

      // Add experiment to sidebar
      if (update.key.startsWith("experiment:")) {
        const label = update.label || "Untitled Experiment";
        const newFile: FileEntry = {
          key: update.key,
          label,
          shortLabel: truncateSourceName(label),
          icon: "experiment",
          group: "experiment",
          fileType: "experiment-design",
        };

        setFiles((prev) => {
          if (prev.some((f) => f.key === newFile.key)) return prev;
          return [...prev, newFile];
        });
        setActiveFileKey(update.key);
      }
    },
    [persistGeneratedNote, updateContent]
  );

  const appendAgentStatusMessage = useCallback(
    (text: string, extras?: Partial<ChatMessage>) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        text,
        timestamp: Date.now(),
        ...(extras ?? {}),
      };
      replaceChatMessages([...chatMessagesRef.current, message]);
      return message;
    },
    [replaceChatMessages]
  );

  const compactSessionHistory = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      appendAgentStatusMessage("Nothing meaningful to compact yet.");
      return;
    }

    setCompactionStatus("compacting");

    try {
      const res = await fetch(
        `/api/agent/${runId}/sessions/${sessionId}/compact`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Compaction failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.message) {
        const message = data.message as ChatMessage;
        replaceChatMessages([...chatMessagesRef.current, message]);
        if (message.taskPlan?.length) {
          setActiveTaskPlan(message.taskPlan);
        }
      }

      if (data.compacted) {
        pulseCompactionStatus();
      } else {
        setCompactionStatus("idle");
      }

      void fetchSessions();
    } catch (error) {
      appendAgentStatusMessage(
        `Unable to compact context: ${(error as Error).message}`
      );
      setCompactionStatus("idle");
    }
  }, [
    appendAgentStatusMessage,
    fetchSessions,
    pulseCompactionStatus,
    replaceChatMessages,
    runId,
    setActiveTaskPlan,
  ]);

  const sendMessage = useCallback(
    async (text: string, attachments?: File[]) => {
      if (isCompactCommand(text, attachments)) {
        await compactSessionHistory();
        return;
      }

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Auto-create session if none active
      let sessionId = activeSessionIdRef.current;
      let needsTitle = false;
      if (!sessionId) {
        try {
          const res = await fetch(`/api/agent/${runId}/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!res.ok) return;
          const data = await res.json();
          sessionId = data.id;
          needsTitle = true;
          setActiveSessionId(sessionId);
          fetchSessions();
        } catch {
          return;
        }
      } else {
        // Check if existing session still has no title (e.g. created via "New chat" button)
        const currentSession = sessions.find((s) => s.id === sessionId);
        if (currentSession && !currentSession.title) {
          needsTitle = true;
        }
      }

      // Build attachment metadata for the user message bubble
      const attachmentInfos: ChatAttachmentInfo[] | undefined = attachments?.map((f) => ({
        name: f.name,
        type: (f.type.startsWith("image/") ? "image" : "pdf") as "image" | "pdf",
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        size: f.size,
      }));

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: Date.now(),
        ...(attachmentInfos?.length ? { attachments: attachmentInfos } : {}),
      };

      const agentMsgId = crypto.randomUUID();
      const agentMsg: ChatMessage = {
        id: agentMsgId,
        role: "agent",
        text: "",
        timestamp: Date.now(),
        isStreaming: true,
        proposedUpdates: [],
        searchResults: [],
        processTrace: [],
      };

      const previousMessages = chatMessagesRef.current;
      const continuationState: AgentContinuationState =
        deriveChatContinuationState(previousMessages);
      replaceChatMessages([...previousMessages, userMsg, agentMsg]);
      setAgentTyping(true);
      setCompactionStatus("idle");
      setLastProviderUsage(null);

      // Build compaction-aware conversation history from previous messages (exclude current pair)
      const history = buildConversationHistoryFromMessages(
        previousMessages,
        continuationState
      );

      // Build edited contents as plain object for API
      const editedObj: Record<string, string> = {};
      editedContents.forEach((val, key) => {
        editedObj[key] = val;
      });

      const controller = new AbortController();
      abortRef.current = controller;
      const traceFileLabels = Object.fromEntries(
        files.map((file) => [file.key, file.shortLabel])
      ) as Record<string, string>;

      let finalAgentText = "";
      let finalProposedUpdates: ProposedUpdate[] | undefined;
      let finalSearchResults: DiscoveredSource[] | undefined;
      let finalAskUserQuestion: ChatAskUserQuestion | undefined;
      let finalTaskPlan: TaskState[] | undefined;

      try {
        // Base64-encode file attachments for the API
        let encodedAttachments: Array<{ type: "image" | "pdf"; name: string; base64: string; mimeType: string }> | undefined;
        if (attachments?.length) {
          encodedAttachments = await Promise.all(
            attachments.map(async (file) => {
              const buffer = await file.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              // Chunked base64 encoding to avoid btoa crash on large strings
              let binary = "";
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
              }
              const base64 = btoa(binary);
              return {
                type: (file.type.startsWith("image/") ? "image" : "pdf") as "image" | "pdf",
                name: file.name,
                base64,
                mimeType: file.type,
              };
            })
          );
        }

        const res = await fetch(`/api/agent/${runId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            reasoningEffort,
            ...(encodedAttachments?.length ? { attachments: encodedAttachments } : {}),
            conversationHistory: history,
            historyVisibleMessageCount: previousMessages.length,
            agentState: continuationState,
            workspaceContext: {
              editedContents: editedObj,
              activeFileKey,
              folderPaths,
              searchFilters,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            let event: {
              type: string;
              content?: string;
              activity?: string;
              name?: string;
              args?: Record<string, unknown>;
              result?: string;
              update?: ProposedUpdate;
              results?: DiscoveredSource[];
              sources?: Array<{ sourceId: string; key: string; label: string; content: string; sourceUrl?: string; paperQuality?: PaperQualityMeta; folder?: string }>;
              skills?: string[];
              question?: AskUserQuestion;
              tasks?: TaskState[];
              taskId?: string;
              status?: string;
              message?: string;
              scope?: "history" | "turn";
              estimatedTokensBefore?: number;
              estimatedTokensAfter?: number;
              snapshot?: ChatMessage["compactionSnapshot"];
              usage?: TokenUsage;
            };
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }

            switch (event.type) {
              case "activity":
                if (event.activity) {
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            activityLabel: event.activity,
                            processTrace: recordProcessActivity(
                              m.processTrace ?? [],
                              event.activity!
                            ),
                          }
                        : m
                    )
                  );
                } else {
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, activityLabel: event.activity }
                        : m
                    )
                  );
                }
                break;

              case "text_delta":
                finalAgentText += event.content ?? "";
                updateChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, text: m.text + (event.content ?? ""), activityLabel: undefined }
                      : m
                  )
                );
                break;

              case "tool_call":
                if (event.name) {
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            processTrace: recordToolCallTrace(
                              m.processTrace ?? [],
                              event.name!,
                              event.args ?? {},
                              traceFileLabels
                            ),
                          }
                        : m
                    )
                  );
                }
                break;

              case "proposed_update":
                if (event.update) {
                  if (event.update.type === "new") {
                    // Auto-accept new files/papers — no approval needed
                    const pu: ProposedUpdate = { ...event.update, status: "accepted" };
                    finalProposedUpdates = [...(finalProposedUpdates ?? []), pu];
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === agentMsgId
                          ? {
                              ...m,
                              proposedUpdates: [...(m.proposedUpdates ?? []), pu],
                            }
                          : m
                      )
                    );
                    // Apply immediately
                    autoApplyNewUpdate(pu);
                  } else if (autoAcceptEditsRef.current) {
                    // Auto-accept mode: apply edits immediately
                    const pu: ProposedUpdate = { ...event.update, status: "accepted" };
                    finalProposedUpdates = [...(finalProposedUpdates ?? []), pu];
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === agentMsgId
                          ? {
                              ...m,
                              proposedUpdates: [...(m.proposedUpdates ?? []), pu],
                            }
                          : m
                      )
                    );
                    updateContent(event.update.key, event.update.content);
                    setActiveFileKey(event.update.key);
                  } else {
                    // Edits require user approval
                    const pu: ProposedUpdate = { ...event.update, status: "pending" };
                    finalProposedUpdates = [...(finalProposedUpdates ?? []), pu];
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === agentMsgId
                          ? {
                              ...m,
                              proposedUpdates: [...(m.proposedUpdates ?? []), pu],
                            }
                          : m
                      )
                    );
                  }
                }
                break;

              case "search_results":
                if (event.results) {
                  finalSearchResults = [
                    ...(finalSearchResults ?? []),
                    ...event.results,
                  ];
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            searchResults: [
                              ...(m.searchResults ?? []),
                              ...event.results!,
                            ],
                          }
                        : m
                    )
                  );
                }
                break;

              case "sources_added":
                if (event.sources) {
                  // Add new sources to sidebar file list
                  setFiles((prev) => {
                    const newFiles = [...prev];
                    for (const s of event.sources!) {
                      if (newFiles.some((f) => f.key === s.key)) continue;
                      traceFileLabels[s.key] = s.label;
                      newFiles.push({
                        key: s.key,
                        label: s.label,
                        shortLabel: truncateSourceName(s.label),
                        icon: "source-discovered",
                        group: "source",
                        origin: "discovered",
                        sourceUrl: s.sourceUrl,
                        paperQuality: s.paperQuality,
                        ...(s.folder ? { folder: s.folder } : {}),
                      });
                    }
                    return newFiles;
                  });
                  // Add content to artifacts so the source is immediately readable
                  setArtifacts((prev) => {
                    if (!prev) return prev;
                    const updated = { ...prev, sources: { ...prev.sources } };
                    for (const s of event.sources!) {
                      const sourceId = s.key.slice(7);
                      if (!updated.sources[sourceId]) {
                        updated.sources[sourceId] = s.content;
                      }
                    }
                    artifactsRef.current = updated;
                    return updated;
                  });
                }
                break;

              case "ask_user":
                if (event.question) {
                  const askQ: ChatAskUserQuestion = {
                    ...event.question,
                    status: "pending",
                  };
                  finalAskUserQuestion = askQ;
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, askUserQuestion: askQ, activityLabel: "Waiting for your input" }
                        : m
                    )
                  );
                }
                break;

              case "tool_result":
                updateChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? {
                          ...m,
                          processTrace: completeActiveProcessTrace(
                            m.processTrace ?? []
                          ),
                        }
                      : m
                  )
                );
                // Detect ask_user timeout: if the tool_result is for ask_user
                // and the question is still "pending", mark it as timed out
                if (event.name === "ask_user" && finalAskUserQuestion?.status === "pending") {
                  const timedOut: ChatAskUserQuestion = {
                    ...finalAskUserQuestion,
                    status: "timed_out",
                  };
                  finalAskUserQuestion = timedOut;
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, askUserQuestion: timedOut }
                        : m
                    )
                  );
                }
                break;

              case "skill_activated":
                if (event.skills?.length) {
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            activatedSkills: Array.from(
                              new Set([
                                ...(m.activatedSkills ?? []),
                                ...event.skills!,
                              ])
                            ),
                          }
                        : m
                    )
                  );
                }
                break;

              case "context_compacted":
                if (event.scope === "history" && event.snapshot) {
                  const snapshot = event.snapshot;
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            compactionSnapshot: snapshot,
                            activatedSkills: snapshot.activatedSkills,
                          }
                        : m
                    )
                  );
                }
                pulseCompactionStatus();
                break;

              case "task_plan":
                if (event.tasks) {
                  finalTaskPlan = event.tasks;
                  setActiveTaskPlan(event.tasks);
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, taskPlan: event.tasks }
                        : m
                    )
                  );
                }
                break;

              case "task_update":
                if (event.taskId && event.status) {
                  updateChatMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== agentMsgId || !m.taskPlan) return m;
                      const updatedTasks = m.taskPlan.map((t) =>
                        t.id === event.taskId
                          ? {
                              ...t,
                              status: event.status as TaskState["status"],
                              ...(event.result ? { result: event.result } : {}),
                            }
                          : t
                      );
                      finalTaskPlan = updatedTasks;
                      setActiveTaskPlan(updatedTasks);
                      return { ...m, taskPlan: updatedTasks };
                    })
                  );
                }
                break;

              case "error":
                updateChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? {
                          ...m,
                          text:
                            m.text +
                            (m.text ? "\n\n" : "") +
                            `⚠ ${event.message ?? "An error occurred"}`,
                        }
                      : m
                  )
                );
                updateChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? {
                          ...m,
                          processTrace: failActiveProcessTrace(
                            m.processTrace ?? [],
                            event.message ?? "Agent error"
                          ),
                        }
                      : m
                  )
                );
                break;

              case "done":
                if (event.usage) {
                  setLastProviderUsage(event.usage);
                }
                updateChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? {
                          ...m,
                          isStreaming: false,
                          ...(event.usage ? { providerUsage: event.usage } : {}),
                          processTrace: completeActiveProcessTrace(
                            m.processTrace ?? []
                          ),
                        }
                      : m
                  )
                );
                setAgentTyping(false);
                break;
            }
          }
        }

        // Ensure streaming is marked complete
        updateChatMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? {
                  ...m,
                  isStreaming: false,
                  processTrace: completeActiveProcessTrace(m.processTrace ?? []),
                }
              : m
          )
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;

        updateChatMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? {
                  ...m,
                  text: m.text || `Failed to get response: ${(err as Error).message}`,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setAgentTyping(false);
        abortRef.current = null;

        // Persist message pair to DB
        if (sessionId) {
          const currentAgentMessage = chatMessagesRef.current.find(
            (message) => message.id === agentMsgId
          );
          const agentText = currentAgentMessage?.text ?? finalAgentText;
          const agentMetadata = buildPersistedMessageMetadata({
            proposedUpdates:
              currentAgentMessage?.proposedUpdates ?? finalProposedUpdates,
            searchResults:
              currentAgentMessage?.searchResults ?? finalSearchResults,
            askUserQuestion:
              currentAgentMessage?.askUserQuestion ?? finalAskUserQuestion,
            taskPlan:
              currentAgentMessage?.taskPlan ?? finalTaskPlan,
            processTrace:
              currentAgentMessage?.processTrace,
            activatedSkills: currentAgentMessage?.activatedSkills,
            compactionSnapshot: currentAgentMessage?.compactionSnapshot,
            providerUsage: currentAgentMessage?.providerUsage,
          });

          fetch(
            `/api/agent/${runId}/sessions/${sessionId}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [
                  { id: userMsg.id, role: "user", text },
                  {
                    id: agentMsgId,
                    role: "agent",
                    text: agentText,
                    ...(Object.keys(agentMetadata).length > 0 && {
                      metadata: agentMetadata,
                    }),
                  },
                ],
              }),
            }
          )
            .then((response) => {
              if (!response.ok) return;

              const latestAgentMessage = chatMessagesRef.current.find(
                (message) => message.id === agentMsgId
              );
              if (latestAgentMessage) {
                persistMessageMetadata(latestAgentMessage);
              }
            })
            .catch(() => {});

          // Refresh session list to update timestamps
          fetchSessions();

          // Generate title for sessions that don't have one yet
          if (needsTitle && finalAgentText) {
            fetch(
              `/api/agent/${runId}/sessions/${sessionId}/generate-title`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userMessage: text,
                  agentReply: finalAgentText,
                }),
              }
            )
              .then((r) => r.json())
              .then((data) => {
                if (data.title) {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === sessionId ? { ...s, title: data.title } : s
                    )
                  );
                }
              })
              .catch(() => {});
          }
        }
      }
    },
    [
      activeFileKey,
      autoApplyNewUpdate,
      compactSessionHistory,
      editedContents,
      fetchSessions,
      persistMessageMetadata,
      replaceChatMessages,
      reasoningEffort,
      runId,
      folderPaths,
      searchFilters,
      sessions,
      files,
      updateChatMessages,
      updateContent,
    ]
  );

  const acceptProposedUpdate = useCallback(
    (messageId: string, updateId: string) => {
      const { nextMessages, updatedMessage, appliedUpdate } =
        acceptProposedUpdateInMessages(
          chatMessagesRef.current,
          messageId,
          updateId
        );

      replaceChatMessages(nextMessages);
      if (updatedMessage) {
        persistMessageMetadata(updatedMessage);
      }

      // Apply the content change
      if (appliedUpdate) {
        updateContent(appliedUpdate.key, appliedUpdate.content);

        // If this is a new paper, add it to the sidebar immediately
        if (appliedUpdate.type === "new" && appliedUpdate.key.startsWith("paper:")) {
          const titleMatch = appliedUpdate.content.match(/\\title\{([^}]+)\}/);
          const label = titleMatch?.[1]?.replace(/\\\\$/g, "").trim() || appliedUpdate.label || "Untitled Paper";

          const newFile: FileEntry = {
            key: appliedUpdate.key,
            label,
            shortLabel: truncateSourceName(label),
            icon: "paper",
            group: "paper",
            fileType: "latex",
          };

          setFiles((prev) => {
            if (prev.some((f) => f.key === newFile.key)) return prev;
            return [...prev, newFile];
          });
          setActiveFileKey(appliedUpdate.key);
        }

        // If this is a new note, add it to the sidebar immediately
        if (appliedUpdate.type === "new" && appliedUpdate.key.startsWith("note:")) {
          const label = appliedUpdate.label || "Untitled Note";
          const newFile: FileEntry = {
            key: appliedUpdate.key,
            label,
            shortLabel: truncateSourceName(label),
            icon: "note",
            group: "note",
            ...(appliedUpdate.folder ? { folder: appliedUpdate.folder } : {}),
          };

          setFiles((prev) => {
            if (prev.some((f) => f.key === newFile.key)) return prev;
            return [...prev, newFile];
          });
          if (appliedUpdate.folder) {
            setNoteFolderPaths((prev) =>
              collectFolderPaths([], [...prev, appliedUpdate.folder!])
            );
          }
          persistGeneratedNote(appliedUpdate);
          setActiveFileKey(appliedUpdate.key);
        }

        // If this is a new experiment, add it to the sidebar immediately
        if (appliedUpdate.type === "new" && appliedUpdate.key.startsWith("experiment:")) {
          const label = appliedUpdate.label || "Untitled Experiment";
          const newFile: FileEntry = {
            key: appliedUpdate.key,
            label,
            shortLabel: truncateSourceName(label),
            icon: "experiment",
            group: "experiment",
            fileType: "experiment-design",
          };

          setFiles((prev) => {
            if (prev.some((f) => f.key === newFile.key)) return prev;
            return [...prev, newFile];
          });
          setActiveFileKey(appliedUpdate.key);
        }

        // For edit-type updates: navigate to the edited file so the user sees changes
        if (appliedUpdate.type === "edit") {
          setActiveFileKey(appliedUpdate.key);

          // If editing an experiment, update sidebar label to reflect new title
          if (appliedUpdate.key.startsWith("experiment:") && appliedUpdate.label) {
            setFiles((prev) =>
              prev.map((f) =>
                f.key === appliedUpdate!.key
                  ? { ...f, label: appliedUpdate!.label!, shortLabel: truncateSourceName(appliedUpdate!.label!) }
                  : f
              )
            );
          }
        }
      }
    },
    [persistGeneratedNote, persistMessageMetadata, replaceChatMessages, updateContent]
  );

  const rejectProposedUpdate = useCallback(
    (messageId: string, updateId: string) => {
      const { nextMessages, updatedMessage } =
        updateProposedUpdateStatusInMessages(
          chatMessagesRef.current,
          messageId,
          updateId,
          "rejected"
        );

      replaceChatMessages(nextMessages);
      if (updatedMessage) {
        persistMessageMetadata(updatedMessage);
      }
    },
    [persistMessageMetadata, replaceChatMessages]
  );

  const answerQuestion = useCallback(
    async (messageId: string, questionId: string, answer: string, isCustom: boolean) => {
      // Optimistically update UI to "answered"
      updateChatMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.askUserQuestion) return m;
          return {
            ...m,
            askUserQuestion: { ...m.askUserQuestion, status: "answered" as const, answer },
            activityLabel: "Processing your answer",
          };
        })
      );

      try {
        const res = await fetch(`/api/agent/${runId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, answer, isCustom }),
        });
        if (!res.ok) {
          // Revert on failure
          updateChatMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId || !m.askUserQuestion) return m;
              return {
                ...m,
                askUserQuestion: { ...m.askUserQuestion, status: "pending" as const, answer: undefined },
                activityLabel: undefined,
              };
            })
          );
        }
      } catch {
        // Revert on network error
        updateChatMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId || !m.askUserQuestion) return m;
            return {
              ...m,
              askUserQuestion: { ...m.askUserQuestion, status: "pending" as const, answer: undefined },
              activityLabel: undefined,
            };
          })
        );
      }
    },
    [runId, updateChatMessages]
  );

  const deleteFile = useCallback(
    async (key: string) => {
      let endpoint: string;
      if (key.startsWith("source:")) {
        const sourceId = key.slice(7);
        endpoint = `/api/init/${runId}/sources/${sourceId}`;
      } else if (key.startsWith("paper:")) {
        const paperId = key.slice(6);
        endpoint = `/api/init/${runId}/papers/${paperId}`;
      } else if (key.startsWith("experiment:")) {
        const experimentId = key.slice(11);
        endpoint = `/api/init/${runId}/experiments/${experimentId}`;
      } else if (key.startsWith("note:")) {
        const noteId = key.slice(5);
        endpoint = `/api/init/${runId}/notes/${noteId}`;
      } else {
        return; // Core files cannot be deleted
      }

      // Fire background delete (local-first — don't await)
      fetch(endpoint, { method: "DELETE" }).catch(() => {});

      // Local-first: remove from UI immediately
      setFiles((prev) => prev.filter((f) => f.key !== key));

      // Remove from edited state
      setEditedContents((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      editedRef.current.delete(key);
      dirtyKeysRef.current.delete(key);

      // Remove from artifacts
      setArtifacts((prev) => {
        if (!prev) return prev;
        if (key.startsWith("source:")) {
          const sourceId = key.slice(7);
          const restSources = { ...prev.sources };
          delete restSources[sourceId];
          const next = { ...prev, sources: restSources };
          artifactsRef.current = next;
          return next;
        }
        if (key.startsWith("paper:")) {
          const paperId = key.slice(6);
          const restPapers = { ...(prev.papers || {}) };
          delete restPapers[paperId];
          const next = { ...prev, papers: restPapers };
          artifactsRef.current = next;
          return next;
        }
        if (key.startsWith("experiment:")) {
          const experimentId = key.slice(11);
          const restExperiments = { ...(prev.experiments || {}) };
          delete restExperiments[experimentId];
          const next = { ...prev, experiments: restExperiments };
          artifactsRef.current = next;
          return next;
        }
        if (key.startsWith("note:")) {
          const noteId = key.slice(5);
          const restNotes = { ...(prev.notes || {}) };
          delete restNotes[noteId];
          const next = { ...prev, notes: restNotes };
          artifactsRef.current = next;
          return next;
        }
        return prev;
      });

      // If deleted file was active, switch to first remaining file
      setActiveFileKey((prev) => {
        if (prev !== key) return prev;
        const remaining = files.filter((f) => f.key !== key);
        return remaining.length > 0 ? remaining[0].key : "";
      });
    },
    [runId, files]
  );

  // ── Local-first note operations ──

  const createNote = useCallback(
    (label: string, folder?: string) => {
      const noteId = crypto.randomUUID();
      const key = `note:${noteId}`;

      // Immediately add to UI
      const newFile: FileEntry = {
        key,
        label,
        shortLabel: truncateSourceName(label),
        icon: "note",
        group: "note",
        ...(folder ? { folder } : {}),
      };

      setFiles((prev) => [...prev, newFile]);
      if (folder) {
        setNoteFolderPaths((prev) => collectFolderPaths([], [...prev, folder]));
      }
      updateContent(key, "");
      setActiveFileKey(key);

      // Update local artifacts
      setArtifacts((prev) => {
        if (!prev) return prev;
        const next = { ...prev, notes: { ...prev.notes, [noteId]: "" } };
        artifactsRef.current = next;
        return next;
      });

      // Background persist
      fetch(`/api/init/${runId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, label, folder: folder || undefined, content: "" }),
      }).catch(() => {});

      return key;
    },
    [runId, updateContent]
  );

  const createExperiment = useCallback(
    (title: string) => {
      const experimentId = crypto.randomUUID();
      const key = `experiment:${experimentId}`;

      // Immediately add to UI
      const newFile: FileEntry = {
        key,
        label: title,
        shortLabel: truncateSourceName(title),
        icon: "experiment",
        group: "experiment",
      };

      setFiles((prev) => [...prev, newFile]);
      updateContent(key, "");
      setActiveFileKey(key);

      // Update local artifacts
      setArtifacts((prev) => {
        if (!prev) return prev;
        const next = { ...prev, experiments: { ...(prev.experiments || {}), [experimentId]: "" } };
        artifactsRef.current = next;
        return next;
      });

      // Background persist
      fetch(`/api/init/${runId}/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experimentId, title, content: "" }),
      }).catch(() => {});

      return key;
    },
    [runId, updateContent]
  );

  const moveNote = useCallback(
    (noteKey: string, newFolder: string | null) => {
      // Immediately update local state
      setFiles((prev) =>
        prev.map((f) =>
          f.key === noteKey ? { ...f, folder: newFolder ?? undefined } : f
        )
      );
      if (newFolder) {
        setNoteFolderPaths((prev) => collectFolderPaths([], [...prev, newFolder]));
      }

      // Background persist
      const noteId = noteKey.slice(5);
      fetch(`/api/init/${runId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: newFolder }),
      }).catch(() => {});
    },
    [runId]
  );

  const renameNote = useCallback(
    (noteKey: string, newLabel: string) => {
      // Immediately update local state
      setFiles((prev) =>
        prev.map((f) =>
          f.key === noteKey
            ? { ...f, label: newLabel, shortLabel: truncateSourceName(newLabel) }
            : f
        )
      );

      // Background persist
      const noteId = noteKey.slice(5);
      fetch(`/api/init/${runId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      }).catch(() => {});
    },
    [runId]
  );

  // ── Add source (upload PDF or paste URL) ──

  const addSource = useCallback(
    async (input: { file?: File; url?: string }) => {
      const tempId = crypto.randomUUID();
      const tempKey = `source:${tempId}`;
      const label = input.file?.name ?? input.url ?? "Loading...";

      // Add placeholder to sidebar immediately
      setFiles((prev) => [
        ...prev,
        {
          key: tempKey,
          label,
          shortLabel: truncateSourceName(label),
          icon: "source-uploaded",
          group: "source",
          origin: "uploaded",
          isLoading: true,
        },
      ]);

      try {
        let res: Response;
        if (input.file) {
          const formData = new FormData();
          formData.append("file", input.file);
          res = await fetch(`/api/init/${runId}/sources`, {
            method: "POST",
            body: formData,
          });
        } else {
          res = await fetch(`/api/init/${runId}/sources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input.url }),
          });
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to add source");
        }

        const data = await res.json();

        // Replace placeholder with real source
        setFiles((prev) =>
          prev.map((f) =>
            f.key === tempKey
              ? {
                  key: data.key,
                  label: data.label,
                  shortLabel: truncateSourceName(data.label),
                  icon: "source-uploaded",
                  group: "source",
                  origin: "uploaded",
                  ...(data.folder ? { folder: data.folder } : {}),
                }
              : f
          )
        );

        // Add to artifacts
        setArtifacts((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            sources: { ...prev.sources, [data.sourceId]: data.content },
          };
          artifactsRef.current = updated;
          return updated;
        });

        setActiveFileKey(data.key);
      } catch (err) {
        // Remove placeholder on error
        setFiles((prev) => prev.filter((f) => f.key !== tempKey));
        throw err;
      }
    },
    [runId]
  );

  const navigateToSource = useCallback(
    (key: string, lineRange?: LineRange) => {
      setActiveFileKey(key);
      setPendingLineRange(lineRange ?? null);
    },
    []
  );

  const clearPendingLineRange = useCallback(() => {
    setPendingLineRange(null);
  }, []);

  const continuationState = useMemo(
    () => deriveChatContinuationState(chatMessages),
    [chatMessages]
  );

  const chatUsage = useMemo(() => {
    const workspaceContext = {
      workspaceFiles: Object.fromEntries(
        files.map((file) => [file.key, getContent(file.key)])
      ) as Record<string, string>,
      activeFileKey,
      availableKeys: files.map((file) => file.key),
      folderPaths,
      fileLabels: Object.fromEntries(
        files.map((file) => [file.key, file.label])
      ) as Record<string, string>,
      fileMeta: Object.fromEntries(
        files.map((file) => [
          file.key,
          { group: file.group, origin: file.origin, folder: file.folder },
        ])
      ),
      searchFilters,
    };
    const baseUsage = estimateLiveContextUsage({
      messages: chatMessages,
      continuation: continuationState,
      workspaceContext,
    });
    const resolvedUsage = resolveDisplayedChatUsage(
      baseUsage,
      lastProviderUsage
    );

    return {
      ...resolvedUsage,
      compactionStatus:
        compactionStatus === "compacting" || compactionStatus === "recently_compacted"
          ? compactionStatus
          : resolvedUsage.compactionStatus,
    };
  }, [
    activeFileKey,
    chatMessages,
    compactionStatus,
      continuationState,
      files,
      folderPaths,
      getContent,
    lastProviderUsage,
    searchFilters,
  ]);

  return {
    loading,
    error,
    artifacts,
    files,
    folderPaths,
    noteFolderPaths,
    activeFileKey,
    setActiveFileKey,
    pendingLineRange,
    navigateToSource,
    clearPendingLineRange,
    getContent,
    updateContent,
    saveStatus,
    saveNow: flushSave,
    deleteFile,
    createNote,
    createFolder,
    deleteFolder,
    createExperiment,
    moveNote,
    renameNote,
    addSource,
    chatMessages,
    chatCollapsed,
    sidebarCollapsed,
    agentTyping,
    sendMessage,
    toggleChat,
    toggleSidebar,
    expanded,
    toggleExpanded,
    acceptProposedUpdate,
    rejectProposedUpdate,
    answerQuestion,
    // Search filters
    searchFilters,
    setSearchFilters,
    // Auto-accept edits
    autoAcceptEdits,
    toggleAutoAcceptEdits,
    reasoningEffort,
    setReasoningEffort: updateReasoningEffort,
    chatUsage,
    // Task plan (top-level for persistent panel)
    activeTaskPlan,
    dismissTaskPlan,
    // Session-related
    sessions,
    activeSessionId,
    sessionsLoading,
    showHistory,
    fetchSessions,
    loadSession,
    createNewSession,
    deleteSession: deleteSessionById,
    renameSession,
    toggleHistory,
    refreshArtifacts,
  };
}
