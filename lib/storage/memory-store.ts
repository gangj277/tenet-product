import type { Artifacts, RunError } from "@/lib/engine/state";
import type { SourceMeta } from "@/lib/db/research-projects";

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
  { id: "analyze_evidence", label: "Extracting evidence" },
  { id: "consolidate_findings", label: "Consolidating findings" },
  { id: "synthesize_project", label: "Writing deliverables" },
  { id: "persist_project", label: "Finalizing project" },
];

function createMemoryStore() {
  const runs = new Map<string, RunEntry>();
  const artifacts = new Map<string, Artifacts>();
  const sourcesMeta = new Map<string, Record<string, SourceMeta>>();
  const uploadedFiles = new Map<string, Buffer>();
  const progress = new Map<string, StepProgress[]>();

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
  };
}

type MemoryStore = ReturnType<typeof createMemoryStore>;

const globalForMemoryStore = globalThis as typeof globalThis & {
  __tenetMemoryStore?: MemoryStore;
};

export const memoryStore =
  globalForMemoryStore.__tenetMemoryStore ??
  (globalForMemoryStore.__tenetMemoryStore = createMemoryStore());
