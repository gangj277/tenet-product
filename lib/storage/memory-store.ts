import type { Artifacts, RunError } from "@/lib/engine/state";
import type { SourceMeta } from "@/lib/storage/project-types";
import type { AskUserAnswer } from "@/lib/agent/state";

interface RunEntry {
  projectId: string;
  runId: string;
  status: string;
  currentStep?: string;
  artifacts?: Artifacts;
  errors?: RunError[];
  updatedAt: string;
}

export interface StepProgress {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail?: string;
  startedAt?: string;
  completedAt?: string;
  subSteps?: { label: string; status: "pending" | "running" | "completed" | "failed" }[];
}

/** The ordered pipeline steps shown to the user after perspective confirmation. */
const PIPELINE_STEPS: Omit<StepProgress, "status">[] = [
  { id: "build_source_set", label: "Parsing sources" },
  { id: "classify_source_folders", label: "Organizing sources" },
  { id: "analyze_evidence", label: "Digesting sources" },
  { id: "consolidate_findings", label: "Adjudicating findings" },
  { id: "synthesize_project", label: "Writing deliverables" },
  { id: "persist_project", label: "Finalizing project" },
];

interface PendingQuestion {
  questionId: string;
  resolve: (answer: AskUserAnswer) => void;
  reject: (reason?: unknown) => void;
  createdAt: number;
}

interface MemoryStoreState {
  runs: Map<string, RunEntry>;
  artifacts: Map<string, Artifacts>;
  sourcesMeta: Map<string, Record<string, SourceMeta>>;
  uploadedFiles: Map<string, Buffer>;
  progress: Map<string, StepProgress[]>;
  pendingQuestions: Map<string, PendingQuestion>;
}

function createMemoryStoreState(
  existing?: Partial<MemoryStoreState>
): MemoryStoreState {
  return {
    runs:
      existing?.runs instanceof Map
        ? existing.runs
        : new Map<string, RunEntry>(),
    artifacts:
      existing?.artifacts instanceof Map
        ? existing.artifacts
        : new Map<string, Artifacts>(),
    sourcesMeta:
      existing?.sourcesMeta instanceof Map
        ? existing.sourcesMeta
        : new Map<string, Record<string, SourceMeta>>(),
    uploadedFiles:
      existing?.uploadedFiles instanceof Map
        ? existing.uploadedFiles
        : new Map<string, Buffer>(),
    progress:
      existing?.progress instanceof Map
        ? existing.progress
        : new Map<string, StepProgress[]>(),
    pendingQuestions:
      existing?.pendingQuestions instanceof Map
        ? existing.pendingQuestions
        : new Map<string, PendingQuestion>(),
  };
}

function createMemoryStore(state: MemoryStoreState) {
  const { runs, artifacts, sourcesMeta, uploadedFiles, progress, pendingQuestions } = state;

  return {
    // Runs
    setRun(runId: string, entry: RunEntry) {
      runs.set(runId, { ...entry, updatedAt: new Date().toISOString() });
    },
    getRun(runId: string): RunEntry | undefined {
      return runs.get(runId);
    },
    listRuns(): RunEntry[] {
      return Array.from(runs.values());
    },
    deleteProject(projectId: string) {
      for (const run of Array.from(runs.values())) {
        if (run.projectId !== projectId) continue;
        runs.delete(run.runId);
        progress.delete(run.runId);
        const pending = pendingQuestions.get(run.runId);
        if (pending) {
          pending.reject(new Error("Project deleted"));
          pendingQuestions.delete(run.runId);
        }
      }
      artifacts.delete(projectId);
      sourcesMeta.delete(projectId);
    },

    // Artifacts
    async saveArtifacts(projectId: string, arts: Artifacts) {
      artifacts.set(projectId, arts);
    },
    getArtifacts(projectId: string): Artifacts | undefined {
      return artifacts.get(projectId);
    },
    updateArtifactContent(projectId: string, key: string, content: string) {
      const arts = artifacts.get(projectId);
      if (!arts) return;
      if (key.startsWith("source:")) {
        arts.sources[key.slice(7)] = content;
      } else if (key.startsWith("note:")) {
        if (!arts.notes) arts.notes = {};
        arts.notes[key.slice(5)] = content;
      } else if (key.startsWith("experiment:")) {
        if (!arts.experiments) arts.experiments = {};
        arts.experiments[key.slice(11)] = content;
      } else if (key in arts) {
        (arts as unknown as Record<string, unknown>)[key] = content;
      }
    },

    // Sources metadata
    saveSourcesMeta(projectId: string, meta: Record<string, SourceMeta>) {
      sourcesMeta.set(projectId, meta);
    },
    getSourcesMeta(projectId: string): Record<string, SourceMeta> | undefined {
      return sourcesMeta.get(projectId);
    },

    // File uploads
    saveFile(key: string, buffer: Buffer) {
      uploadedFiles.set(key, buffer);
    },
    getFile(key: string): Buffer | undefined {
      return uploadedFiles.get(key);
    },

    // Progress tracking
    initProgress(runId: string) {
      progress.set(
        runId,
        PIPELINE_STEPS.map((s) => ({ ...s, status: "pending" as const }))
      );
    },

    updateProgress(
      runId: string,
      stepId: string,
      update: Partial<Pick<StepProgress, "status" | "detail" | "subSteps">>
    ) {
      const steps = progress.get(runId);
      if (!steps) return;
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      if (update.status === "running" && !step.startedAt) {
        step.startedAt = new Date().toISOString();
      }
      if (update.status === "completed") {
        step.completedAt = new Date().toISOString();
      }
      if (update.status) step.status = update.status;
      if (update.detail !== undefined) step.detail = update.detail;
      if (update.subSteps) step.subSteps = update.subSteps;
    },

    getProgress(runId: string): StepProgress[] | undefined {
      return progress.get(runId);
    },

    // Pending questions (ask_user pause/resume)
    registerPendingQuestion(runId: string, questionId: string): Promise<AskUserAnswer> {
      // Cancel any existing pending question for this run
      const existing = pendingQuestions.get(runId);
      if (existing) {
        existing.reject(new Error("Superseded by new question"));
        pendingQuestions.delete(runId);
      }

      return new Promise<AskUserAnswer>((resolve, reject) => {
        pendingQuestions.set(runId, {
          questionId,
          resolve,
          reject,
          createdAt: Date.now(),
        });
      });
    },

    resolvePendingQuestion(runId: string, answer: AskUserAnswer): boolean {
      const pending = pendingQuestions.get(runId);
      if (!pending) return false;
      if (pending.questionId !== answer.questionId) return false;
      pending.resolve(answer);
      pendingQuestions.delete(runId);
      return true;
    },

    cancelPendingQuestion(runId: string): boolean {
      const pending = pendingQuestions.get(runId);
      if (!pending) return false;
      pending.reject(new Error("Question cancelled"));
      pendingQuestions.delete(runId);
      return true;
    },

    hasPendingQuestion(runId: string): boolean {
      return pendingQuestions.has(runId);
    },

    getPendingQuestionId(runId: string): string | undefined {
      return pendingQuestions.get(runId)?.questionId;
    },
  };
}

type MemoryStore = ReturnType<typeof createMemoryStore>;

const globalForMemoryStore = globalThis as typeof globalThis & {
  __lumenMemoryStore?: MemoryStore;
  __lumenMemoryStoreState?: Partial<MemoryStoreState>;
};

// Keep only the mutable state on globalThis so hot reload picks up the latest API shape.
const memoryStoreState = createMemoryStoreState(
  globalForMemoryStore.__lumenMemoryStoreState
);

globalForMemoryStore.__lumenMemoryStoreState = memoryStoreState;

export const memoryStore = createMemoryStore(memoryStoreState);

globalForMemoryStore.__lumenMemoryStore = memoryStore;
