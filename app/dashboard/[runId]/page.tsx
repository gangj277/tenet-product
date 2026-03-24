"use client";

import { use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import type {
  Perspective,
  RunError,
  UserInput,
} from "@/lib/engine/state";
import type { StepProgress } from "@/lib/storage/memory-store";
import { PerspectiveReview } from "../_components/perspective-review";
import { SearchFilterPanel } from "../_components/search-filter-panel";
import { useWorkspace } from "./_hooks/use-workspace";
import { WorkspaceLayout } from "./_components/layout";
import { FileSidebar } from "./_components/sidebar";
import { DocumentViewer } from "./_components/viewer";
import { AgentChat, type ChatComposerHandle } from "./_components/chat";
import { findPendingUpdateForFile } from "./_lib/workspace-types";

type WorkspaceRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "awaiting_confirmation"
  | "failed"
  | "partial"
  | "completed";

interface RunStatusResponse {
  runId: string;
  projectId: string;
  status: WorkspaceRunStatus;
  currentStep?: string;
  errors?: RunError[];
  progress?: StepProgress[];
  perspective?: Perspective;
}

const POLLABLE_RUN_STATUSES = new Set<WorkspaceRunStatus>([
  "running",
  "awaiting_confirmation",
]);
const COMPLETED_ANALYSIS_STATUSES = new Set<WorkspaceRunStatus>([
  "completed",
  "partial",
]);

export default function ResultsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const ws = useWorkspace(runId);
  const chatRef = useRef<ChatComposerHandle>(null);
  const previousStatusRef = useRef<WorkspaceRunStatus | null>(null);
  const refreshArtifacts = ws.refreshArtifacts;

  const [runState, setRunState] = useState<RunStatusResponse | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewPerspective, setReviewPerspective] = useState<Perspective | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState<Partial<UserInput>>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilterConfig>({});

  const handleQuoteToChat = (text: string, sourceLabel: string) => {
    if (ws.chatCollapsed) ws.toggleChat();
    chatRef.current?.injectQuotedContext(text, sourceLabel);
  };

  const refreshRunStatus = useCallback(async () => {
    const response = await fetch(`/api/init/${runId}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `Failed to load run status (HTTP ${response.status})`
      );
    }

    const data = (await response.json()) as RunStatusResponse;
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = data.status;

    setRunState(data);
    if (data.status === "awaiting_confirmation" && data.perspective) {
      setReviewPerspective((current) => current ?? data.perspective ?? null);
    }

    if (
      previousStatus &&
      previousStatus !== data.status &&
      COMPLETED_ANALYSIS_STATUSES.has(data.status)
    ) {
      void refreshArtifacts().catch(() => {});
    }

    return data;
  }, [refreshArtifacts, runId]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const data = await refreshRunStatus();
        if (!active) return;
        if (POLLABLE_RUN_STATUSES.has(data.status)) {
          timeoutId = setTimeout(poll, 2500);
        }
      } catch (error) {
        if (active) {
          setAnalysisError((error as Error).message);
        }
      }
    };

    void poll();

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [refreshRunStatus]);

  const handleStartDeepAnalysis = useCallback(async () => {
    if (!question.trim()) return;

    setSetupSubmitting(true);
    setAnalysisError(null);

    try {
      const hasFilters = Object.values(searchFilters).some(
        (value) =>
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
      );
      const input: UserInput = {
        researchQuestion: question.trim(),
        ...advanced,
        ...(hasFilters ? { searchFilters } : {}),
      };

      const response = await fetch(`/api/init/${runId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start deep analysis");
      }

      const data = (await response.json()) as RunStatusResponse;
      previousStatusRef.current = data.status;
      setRunState(data);
      setReviewPerspective(data.perspective ?? null);
      setSetupOpen(false);
    } catch (error) {
      setAnalysisError((error as Error).message);
    } finally {
      setSetupSubmitting(false);
    }
  }, [advanced, question, runId, searchFilters]);

  const handleConfirmPerspective = useCallback(
    async (action: "accept" | "edit", edited?: Perspective) => {
      setReviewSubmitting(true);
      setAnalysisError(null);

      try {
        const body: Record<string, unknown> = { action };
        if (action === "edit" && edited) {
          body.perspective = edited;
        }

        const response = await fetch(`/api/init/${runId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to continue analysis");
        }

        previousStatusRef.current = "running";
        setRunState((current) =>
          current
            ? { ...current, status: "running", perspective: undefined }
            : {
                runId,
                projectId: "",
                status: "running",
              }
        );
        setReviewPerspective(null);
      } catch (error) {
        setAnalysisError((error as Error).message);
      } finally {
        setReviewSubmitting(false);
      }
    },
    [runId]
  );

  if (ws.loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-72px)]">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-accent-fill border-t-transparent rounded-full animate-spin" />
          <span className="font-sans text-[14px] text-sub">
            Loading workspace...
          </span>
        </div>
      </div>
    );
  }

  if (ws.error || !ws.artifacts) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-72px)]">
        <div className="text-center">
          <p className="font-sans text-[14px] text-sub mb-4">
            {ws.error || "No results found"}
          </p>
          <Link
            href="/dashboard"
            className="font-sans text-[13px] text-accent hover:text-accent-hover transition-colors"
          >
            Start a new project
          </Link>
        </div>
      </div>
    );
  }

  const activeFile = ws.files.find((file) => file.key === ws.activeFileKey);
  const pendingUpdate = ws.activeFileKey
    ? findPendingUpdateForFile(ws.chatMessages, ws.activeFileKey)
    : null;
  const banner = buildBannerState(runState, analysisError);

  return (
    <div className="relative h-[calc(100vh-72px)]">
      <WorkspaceLayout
        chatCollapsed={ws.chatCollapsed}
        sidebarCollapsed={ws.sidebarCollapsed}
        expanded={ws.expanded}
        onToggleSidebar={ws.toggleSidebar}
        onToggleChat={ws.toggleChat}
        sidebar={
          <FileSidebar
            files={ws.files}
            activeFileKey={ws.activeFileKey}
            onSelect={ws.setActiveFileKey}
            onDelete={ws.deleteFile}
            onCreateNote={ws.createNote}
            onMoveNote={ws.moveNote}
            onRenameNote={ws.renameNote}
            onAddSource={ws.addSource}
            onCreateExperiment={ws.createExperiment}
            noteFolderPaths={ws.noteFolderPaths}
            onCreateFolder={ws.createFolder}
            onDeleteFolder={ws.deleteFolder}
          />
        }
        document={
          <DocumentViewer
            activeFile={activeFile}
            content={ws.getContent(ws.activeFileKey)}
            onUpdate={(markdown) => ws.updateContent(ws.activeFileKey, markdown)}
            onNavigateSource={ws.navigateToSource}
            sourceFiles={ws.files}
            saveStatus={ws.saveStatus}
            onSave={ws.saveNow}
            pendingLineRange={ws.pendingLineRange}
            onScrollComplete={ws.clearPendingLineRange}
            expanded={ws.expanded}
            onToggleExpanded={ws.toggleExpanded}
            pendingUpdate={pendingUpdate}
            onAcceptUpdate={ws.acceptProposedUpdate}
            onRejectUpdate={ws.rejectProposedUpdate}
            onQuoteToChat={handleQuoteToChat}
          />
        }
        chat={
          <AgentChat
            ref={chatRef}
            messages={ws.chatMessages}
            agentTyping={ws.agentTyping}
            collapsed={ws.chatCollapsed}
            onToggle={ws.toggleChat}
            onSend={ws.sendMessage}
            onAcceptUpdate={ws.acceptProposedUpdate}
            onRejectUpdate={ws.rejectProposedUpdate}
            onAnswerQuestion={ws.answerQuestion}
            onOpenProposal={ws.setActiveFileKey}
            reasoningEffort={ws.reasoningEffort}
            onReasoningEffortChange={ws.setReasoningEffort}
            sessions={ws.sessions}
            activeSessionId={ws.activeSessionId}
            showHistory={ws.showHistory}
            onToggleHistory={ws.toggleHistory}
            onSelectSession={ws.loadSession}
            onNewSession={ws.createNewSession}
            onDeleteSession={ws.deleteSession}
            onRenameSession={ws.renameSession}
            files={ws.files}
            folderPaths={ws.folderPaths}
            onNavigateSource={ws.navigateToSource}
            searchFilters={ws.searchFilters}
            onSearchFiltersChange={ws.setSearchFilters}
            getContent={ws.getContent}
            autoAcceptEdits={ws.autoAcceptEdits}
            onAutoAcceptEditsChange={ws.toggleAutoAcceptEdits}
            activeTaskPlan={ws.activeTaskPlan}
            onDismissTaskPlan={ws.dismissTaskPlan}
            usage={ws.chatUsage}
          />
        }
      />

      {banner && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 w-full max-w-3xl -translate-x-1/2 px-4">
          <div className="pointer-events-auto">
            <WorkspaceStatusBanner
              title={banner.title}
              description={banner.description}
              tone={banner.tone}
              actionLabel={banner.actionLabel}
              onAction={banner.actionLabel ? () => setSetupOpen(true) : undefined}
            />
          </div>
        </div>
      )}

      {setupOpen && (
        <ModalShell
          title="Start Deep Analysis"
          onClose={() => {
            if (!setupSubmitting) {
              setSetupOpen(false);
            }
          }}
        >
          <div className="space-y-5">
            <div>
              <p className="font-sans text-[13px] leading-[1.7] text-sub mb-4">
                Turn this draft workspace into a full research run. Existing
                sources in the workspace will be reused automatically.
              </p>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What question should deep analysis answer?"
                rows={4}
                disabled={setupSubmitting}
                className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3.5 font-serif text-[15px] leading-[1.7] text-heading placeholder:text-dim/60 placeholder:font-sans placeholder:text-[14px] focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 resize-y disabled:opacity-50"
              />
            </div>

            <div>
              <button
                onClick={() => setShowAdvanced((value) => !value)}
                disabled={setupSubmitting}
                className="font-sans text-[12px] text-dim hover:text-sub transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`transition-transform duration-200 ${
                    showAdvanced ? "rotate-90" : ""
                  }`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Advanced options
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pl-0.5">
                  <AdvancedField
                    label="Research intent"
                    placeholder="What do you hope to achieve with this research?"
                    value={advanced.researchIntent || ""}
                    onChange={(value) =>
                      setAdvanced({
                        ...advanced,
                        researchIntent: value || undefined,
                      })
                    }
                  />
                  <AdvancedField
                    label="Working hypothesis"
                    placeholder="Your current best guess or thesis"
                    value={advanced.workingHypothesis || ""}
                    onChange={(value) =>
                      setAdvanced({
                        ...advanced,
                        workingHypothesis: value || undefined,
                      })
                    }
                  />
                  <AdvancedField
                    label="Scope boundaries"
                    placeholder="What is explicitly out of scope?"
                    value={advanced.scopeBoundaries || ""}
                    onChange={(value) =>
                      setAdvanced({
                        ...advanced,
                        scopeBoundaries: value || undefined,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <AdvancedField
                      label="Audience"
                      placeholder="e.g. ML researchers"
                      value={advanced.audience || ""}
                      onChange={(value) =>
                        setAdvanced({ ...advanced, audience: value || undefined })
                      }
                    />
                    <AdvancedField
                      label="Time horizon"
                      placeholder="e.g. 2020-present"
                      value={advanced.timeHorizon || ""}
                      onChange={(value) =>
                        setAdvanced({
                          ...advanced,
                          timeHorizon: value || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="pt-3 mt-3 border-t border-edge/20">
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-3">
                      Source discovery filters
                    </p>
                    <SearchFilterPanel
                      filters={searchFilters}
                      onChange={setSearchFilters}
                    />
                  </div>
                </div>
              )}
            </div>

            {analysisError && (
              <div className="px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
                <p className="font-sans text-[13px] text-red-400">
                  {analysisError}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleStartDeepAnalysis}
                disabled={!question.trim() || setupSubmitting}
                className="font-sans text-[13px] font-medium px-6 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-50 cursor-pointer"
              >
                {setupSubmitting ? "Preparing brief..." : "Generate research brief"}
              </button>
              <button
                onClick={() => setSetupOpen(false)}
                disabled={setupSubmitting}
                className="font-sans text-[13px] text-sub hover:text-heading transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {reviewPerspective && (
        <ModalShell
          title="Review Research Brief"
          onClose={() => {
            if (!reviewSubmitting) {
              setReviewPerspective(null);
            }
          }}
          widthClassName="max-w-4xl"
        >
          <PerspectiveReview
            perspective={reviewPerspective}
            onAccept={() => handleConfirmPerspective("accept")}
            onEdit={(edited) => handleConfirmPerspective("edit", edited)}
            disabled={reviewSubmitting}
          />
        </ModalShell>
      )}
    </div>
  );
}

function buildBannerState(
  runState: RunStatusResponse | null,
  analysisError: string | null
) {
  if (runState?.status === "draft") {
    return {
      title: "Draft workspace",
      description:
        "You can work immediately, add notes and sources, and start deep analysis when ready.",
      tone: "draft" as const,
      actionLabel: "Start deep analysis",
    };
  }

  if (runState?.status === "running") {
    return {
      title: "Deep analysis running in background",
      description:
        describeRunningState(runState.currentStep, runState.progress) ||
        "You can keep working while the initial analysis completes.",
      tone: "running" as const,
    };
  }

  if (runState?.status === "failed" || analysisError) {
    const latestError =
      runState?.errors?.[runState.errors.length - 1]?.message ?? analysisError;
    return {
      title: "Deep analysis failed",
      description:
        latestError || "The analysis run did not complete successfully.",
      tone: "failed" as const,
    };
  }

  return null;
}

function describeRunningState(
  currentStep?: string,
  progress?: StepProgress[]
) {
  const activeStep =
    progress?.find((step) => step.status === "running")?.label ??
    humanizeStep(currentStep);
  const completedCount =
    progress?.filter((step) => step.status === "completed").length ?? 0;
  const totalCount = progress?.length ?? 0;

  if (activeStep && totalCount > 0) {
    return `${activeStep} · ${completedCount}/${totalCount} steps complete`;
  }

  return activeStep;
}

function humanizeStep(step?: string) {
  if (!step) return "";
  return step
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function WorkspaceStatusBanner({
  title,
  description,
  tone,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  tone: "draft" | "running" | "failed";
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneClass =
    tone === "failed"
      ? "border-red-500/25 bg-red-500/8"
      : tone === "running"
        ? "border-amber-500/20 bg-amber-500/8"
        : "border-sky-400/20 bg-sky-400/8";

  return (
    <div
      className={`rounded-xl border px-4 py-3 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-dim mb-1">
            {title}
          </p>
          <p className="font-sans text-[13px] leading-[1.6] text-sub">
            {description}
          </p>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="shrink-0 font-sans text-[12px] font-medium px-4 py-2 rounded-lg bg-accent-fill text-on-accent hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  widthClassName = "max-w-3xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-page/78 backdrop-blur-md px-4 py-8">
      <div
        className={`w-full ${widthClassName} max-h-[calc(100vh-96px)] overflow-y-auto glass-panel rounded-2xl border border-edge/40 shadow-[0_24px_80px_rgba(0,0,0,0.35)]`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge/30">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
              Workspace setup
            </p>
            <h2 className="font-serif text-[22px] leading-[1.2] tracking-[-0.02em] text-heading mt-1">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-page text-dim hover:text-sub transition-colors cursor-pointer"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function AdvancedField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-dim block mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-edge/40 text-[13px] text-body py-1.5 placeholder:text-dim/40 focus:outline-none focus:border-accent/40 transition-colors"
      />
    </div>
  );
}
