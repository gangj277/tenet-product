import { Annotation } from "@langchain/langgraph";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";

// ── Sub-types ──

export interface UserInput {
  researchQuestion: string;
  researchIntent?: string;
  workingHypothesis?: string;
  scopeBoundaries?: string;
  mustAnswerQuestions?: string[];
  audience?: string;
  geography?: string;
  timeHorizon?: string;
  outputLanguage?: string;
  searchFilters?: SearchFilterConfig;
}

export interface SourceEntry {
  sourceId: string;
  name: string;
  origin: "uploaded" | "discovered";
  mimeType: string;
  checksum: string;
  storageUrl: string;
  parseStatus: "pending" | "parsed" | "failed";
  parsedContent?: string;
  metadata?: SourceMetadata;
}

export interface SourceMetadata {
  sourceKind: "pdf" | "html";
  sourceUrl?: string;
  resolvedUrl?: string;
  httpContentType?: string;
  sniffedMimeType: string;
  rawBlobKey: string;
  normalizedBlobKey?: string;
  byteSize: number;
  charCount?: number;
  estimatedTokens?: number;
  parseEngine?: string;
  parseAttempts?: number;
  parseQuality?: "validated" | "fallback_validated" | "rejected";
  parseError?: string;
  paperQuality?: PaperQualityMeta;
}

export interface Perspective {
  projectTitle: string;
  briefSummary: string;
  interpretedIntent: string;
  inferredResearchFrame: string;
  evidenceForCriteria: string[];
  evidenceAgainstCriteria: string[];
  subquestions: string[];
}

export interface ParsedSource {
  sourceId: string;
  name: string;
  normalizedBlobKey: string;
  charCount: number;
  estimatedTokens: number;
  parseQuality: "validated" | "fallback_validated";
  metadata: Record<string, unknown>;
}

export interface SourceChunk {
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
  headingPath: string;
  tokenEstimate: number;
  charCount: number;
  blobKey: string;
}

export interface EvidenceItem {
  claim: string;
  sourceId: string;
  sourceName: string;
  location: string;
  confidence: "high" | "medium" | "low";
  evidenceType: "supporting" | "contradictory" | "methodological" | "neutral";
  quote?: string;
}

export interface EvidenceMap {
  supportingEvidence: EvidenceItem[];
  contradictoryEvidence: EvidenceItem[];
  strongClaims: EvidenceItem[];
  uncertainties: EvidenceItem[];
  methodologicalCautions: EvidenceItem[];
  personaFindings: Record<string, EvidenceItem[]>;
}

export interface ConsolidatedFindings {
  canonicalClaims: Array<{
    claim: string;
    support: EvidenceItem[];
    contradictions: EvidenceItem[];
    confidence: string;
  }>;
  prioritizedSupport: EvidenceItem[];
  prioritizedContradictions: EvidenceItem[];
  openQuestions: string[];
  confidenceNotes: string[];
  unresolvedDisagreements: string[];
}

export interface Artifacts {
  overview: string;
  synthesis: string;
  claims: string;
  gaps: string;
  nextSteps: string;
  sources: Record<string, string>;
  papers: Record<string, string>;
  notes: Record<string, string>;
  experiments: Record<string, string>;
}



export interface SearchQueryPlan {
  queries: Array<{
    query: string;
    intent: string;
  }>;
}

export interface RunError {
  step: string;
  message: string;
  retryable: boolean;
  timestamp: string;
}

// ── LangGraph State Annotation ──

export const InitRunAnnotation = Annotation.Root({
  projectId: Annotation<string>(),
  runId: Annotation<string>(),
  userId: Annotation<string>(),
  status: Annotation<
    "queued" | "running" | "awaiting_confirmation" | "failed" | "partial" | "completed"
  >(),
  currentStep: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  input: Annotation<UserInput>(),

  sources: Annotation<SourceEntry[]>({
    reducer: (existing, incoming) => {
      const map = new Map(existing.map((s) => [s.sourceId, s]));
      for (const s of incoming) {
        map.set(s.sourceId, { ...map.get(s.sourceId), ...s });
      }
      return Array.from(map.values());
    },
    default: () => [],
  }),

  perspective: Annotation<Perspective | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  searchQueryPlan: Annotation<SearchQueryPlan | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  parsedSources: Annotation<ParsedSource[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  sourceChunks: Annotation<SourceChunk[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  evidenceMap: Annotation<EvidenceMap | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  consolidatedFindings: Annotation<ConsolidatedFindings | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  artifacts: Annotation<Artifacts | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  sourceFolders: Annotation<Record<string, string[]> | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),

  errors: Annotation<RunError[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  startedAt: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  completedAt: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

export type InitRunState = typeof InitRunAnnotation.State;
export type InitRunUpdate = typeof InitRunAnnotation.Update;
