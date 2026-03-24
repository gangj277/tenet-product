// ── Barrel re-export ──
// This file re-exports everything from the domain-focused sub-modules so that
// existing consumers (`import { ... } from "@/lib/db/research-projects"`) keep
// working without any changes.

// Types
export type {
  SourceMeta,
  NoteMeta,
  ExperimentMeta,
  ResearchRunStatus,
  DashboardProjectRecord,
  OwnedRunRecord,
} from "./research-project-types";

// Type-module values
export {
  MAX_PROJECT_TITLE_LENGTH,
  DEFAULT_DRAFT_WORKSPACE_TITLE,
  buildProjectTitle,
  buildWorkspaceTitle,
} from "./research-project-types";

// Lifecycle
export {
  createResearchProjectRun,
  createDraftWorkspaceProjectRun,
  updateResearchRunStatus,
  upsertResearchRunInput,
  updateProjectTitle,
  listResearchProjectsForUser,
  getOwnedResearchRun,
  getResearchRun,
} from "./research-project-lifecycle";

// Artifacts
export {
  ARTIFACT_KEY_TO_TYPE,
  persistResearchArtifacts,
  getPersistedArtifacts,
  updateArtifactContents,
  getPersistedSourcesForRun,
} from "./research-project-artifacts";

// Sources
export {
  getSourceMetadataForRun,
  deleteSource,
  addAgentDiscoveredSource,
} from "./research-project-sources";

// Notes
export {
  createNote,
  deleteNote,
  updateNoteMeta,
  getNoteMetadataForRun,
} from "./research-project-notes";

// Experiments & papers
export {
  createExperiment,
  deleteExperiment,
  getExperimentMetadataForRun,
  deletePaper,
} from "./research-project-experiments";
