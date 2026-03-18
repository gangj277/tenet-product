import { createRequire } from "node:module";
import { mkdtemp, rm } from "fs/promises";
import os from "node:os";
import path from "node:path";

const requireFrom = createRequire(import.meta.url);

type RouteModule<T> = T;

interface PersistedRunRecord {
  runId: string;
  projectId: string;
  userId: string;
  status: string;
  currentStep: string;
  completedAt?: Date | null;
}

interface PersistedArtifactsRecord {
  sources: Array<Record<string, unknown>>;
  sourceChunks: Array<Record<string, unknown>>;
  artifacts: Record<string, unknown>;
}

export interface ForensicInvariantReport {
  passed: string[];
  failed: string[];
}

export interface ForensicInitPipelineReport {
  passed: boolean;
  flowMap: string;
  input: Record<string, unknown>;
  upload: {
    status: number;
    sourceCount: number;
    sourceIds: string[];
  };
  init: {
    statusCode: number;
    status: string;
    runId: string;
    projectId: string;
    perspectiveSummary: string;
  };
  confirm: {
    statusCode: number;
    status: string;
  };
  finalStatus: {
    statusCode: number;
    status: string;
    currentStep: string;
    errorCount: number;
    progress: Array<Record<string, unknown>>;
    polls: number;
  };
  finalState: {
    sourceCount: number;
    parsedSourceCount: number;
    sourceChunkCount: number;
    supportingEvidenceCount: number;
    contradictoryEvidenceCount: number;
    methodologicalCautionCount: number;
    artifactKeys: string[];
    sourceSummaryCount: number;
  };
  persisted: {
    runStatus: string;
    projectStatus: string;
    persistedSourceCount: number;
    persistedChunkCount: number;
    persistedArtifactKeys: string[];
  };
  traces: {
    generatedIds: string[];
    fetchUrls: string[];
    parsedPdfFiles: string[];
    llmJsonSchemas: string[];
    llmArtifactCalls: number;
  };
  invariants: ForensicInvariantReport;
}

const DEFAULT_TEST_INPUT = {
  researchQuestion:
    "What does the recent evidence say about retrieval-augmented generation reducing hallucinations in enterprise support copilots?",
  researchIntent: "Produce a synthesis for product planning",
  workingHypothesis:
    "RAG reduces factual hallucinations when grounding quality is high, but benefits degrade with weak retrieval quality.",
  scopeBoundaries: "Focus on peer-reviewed or rigorous technical evidence from 2023 onward.",
  mustAnswerQuestions: [
    "When does RAG improve answer quality?",
    "What failure modes remain after retrieval is added?",
  ],
  audience: "AI product team",
  geography: "Global",
  timeHorizon: "2023-2026",
  outputLanguage: "English",
};

const TEST_USER = {
  userId: "forensic-user",
  email: "forensic@example.com",
};

export async function runForensicInitPipeline(): Promise<ForensicInitPipelineReport> {
  const previousEnv = {
    LOCAL_BLOB_ROOT: process.env.LOCAL_BLOB_ROOT,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };
  const originalFetch = global.fetch;
  const tempBlobRoot = await mkdtemp(path.join(os.tmpdir(), "tenet-init-forensic-"));

  process.env.LOCAL_BLOB_ROOT = tempBlobRoot;
  process.env.OPENROUTER_API_KEY = "forensic-test-key";

  resetRuntimeSingletons();

  const generatedIds: string[] = [];
  const fetchUrls: string[] = [];
  const parsedPdfFiles: string[] = [];
  const llmJsonSchemas: string[] = [];
  let llmArtifactCalls = 0;

  const persistedRuns = new Map<string, PersistedRunRecord>();
  const persistedProjects = new Map<
    string,
    { projectId: string; userId: string; status: string; title: string }
  >();
  const persistedArtifacts = new Map<string, PersistedArtifactsRecord>();

  const restoreIds = patchModule("../../lib/utils/id.ts", {
    generateId: (() => {
      const values = [
        "upload-source-1",
        "project-forensic-1",
        "run-forensic-1",
        "discovered-source-1",
        "discovered-source-2",
      ];

      return () => {
        const next = values.shift() ?? `generated-${generatedIds.length + 1}`;
        generatedIds.push(next);
        return next;
      };
    })(),
  });

  const restoreSession = patchModule("../../lib/auth/session.ts", {
    getSession: async () => TEST_USER,
  });

  const restoreResearchProjects = patchModule("../../lib/db/research-projects.ts", {
    buildProjectTitle(researchQuestion: string) {
      return researchQuestion.trim().replace(/\s+/g, " ").slice(0, 500);
    },
    async createResearchProjectRun(params: {
      projectId: string;
      runId: string;
      userId: string;
      input: { researchQuestion: string };
      status: string;
      currentStep?: string;
      completedAt?: Date | null;
    }) {
      persistedProjects.set(params.projectId, {
        projectId: params.projectId,
        userId: params.userId,
        status: params.status,
        title: params.input.researchQuestion.trim().replace(/\s+/g, " "),
      });
      persistedRuns.set(params.runId, {
        runId: params.runId,
        projectId: params.projectId,
        userId: params.userId,
        status: params.status,
        currentStep: params.currentStep ?? "",
        completedAt: params.completedAt ?? null,
      });
    },
    async updateResearchRunStatus(params: {
      projectId: string;
      runId: string;
      status: string;
      currentStep?: string;
      completedAt?: Date | null;
    }) {
      const run = persistedRuns.get(params.runId);
      if (run) {
        run.status = params.status;
        if (params.currentStep !== undefined) {
          run.currentStep = params.currentStep;
        }
        if (params.completedAt !== undefined) {
          run.completedAt = params.completedAt;
        }
      }

      const project = persistedProjects.get(params.projectId);
      if (project) {
        project.status = params.status;
      }
    },
    async getOwnedResearchRun(userId: string, runId: string) {
      const run = persistedRuns.get(runId);
      if (!run || run.userId !== userId) return null;
      return {
        runId: run.runId,
        projectId: run.projectId,
        status: run.status,
        currentStep: run.currentStep,
      };
    },
    async getResearchRun(runId: string) {
      const run = persistedRuns.get(runId);
      if (!run) return null;
      return {
        runId: run.runId,
        projectId: run.projectId,
        status: run.status,
        currentStep: run.currentStep,
      };
    },
    async persistResearchArtifacts(params: {
      runId: string;
      sources: Array<Record<string, unknown>>;
      sourceChunks?: Array<Record<string, unknown>>;
      artifacts: Record<string, unknown>;
    }) {
      persistedArtifacts.set(params.runId, {
        sources: params.sources,
        sourceChunks: params.sourceChunks ?? [],
        artifacts: params.artifacts,
      });
    },
  });

  const restoreDiscovery = patchModule("../../lib/discovery/scholarly-search.ts", {
    discoverScholarlySources: async () => [
      {
        title: "RAG Reliability PDF Study",
        url: "https://example.test/rag-reliability",
        pdfUrl: "https://example.test/rag-reliability.pdf?download=1",
      },
      {
        title: "Support Copilot Field Report",
        url: "https://example.test/support-copilot-report",
      },
    ],
  });

  const restorePdfParser = patchModule("../../lib/pdf/gemini-extract.ts", {
    parsePDF: async (_buffer: Buffer, filename: string) => {
      parsedPdfFiles.push(filename);
      return {
        text: buildMockPdfText(filename),
        pageCount: 6,
      };
    },
  });

  const restoreOpenrouter = patchModule("../../lib/llm/openrouter.ts", {
    costTracker: {
      record: () => {},
      snapshot: () => ({
        byModel: {},
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCalls: 0,
      }),
      reset: () => {},
    },
    callLLMJson: async (options: {
      jsonSchema?: { name: string };
      messages: Array<{ role: string; content: string }>;
    }) => {
      const schemaName = options.jsonSchema?.name ?? "unknown";
      llmJsonSchemas.push(schemaName);
      const userContent =
        options.messages.find((message) => message.role === "user")?.content ?? "";

      if (schemaName === "perspective") {
        return {
          data: {
            briefSummary: "Assess whether RAG reduces hallucinations in enterprise support copilots.",
            interpretedIntent: "Evaluate RAG reliability tradeoffs for enterprise support copilots.",
            inferredResearchFrame: "Effectiveness and residual failure modes of retrieval grounding",
            evidenceForCriteria: [
              "Measured reduction in unsupported claims",
              "Evidence tied to retrieval quality",
            ],
            evidenceAgainstCriteria: [
              "No improvement under realistic enterprise conditions",
              "Persistent failures despite retrieval grounding",
            ],
            subquestions: [
              "When does retrieval grounding help?",
              "Which hallucination modes remain after retrieval?",
            ],
          },
          raw: emptyRawResponse(),
        };
      }

      if (schemaName === "chunk_evidence_items") {
        const payload = JSON.parse(userContent) as {
          sourceId: string;
          sourceName: string;
          headingPath: string;
          chunkText: string;
        };

        const items =
          payload.chunkText.includes("27% drop")
            ? [
                {
                  claim: "RAG grounding reduced unsupported factual statements in the study setting.",
                  sourceId: payload.sourceId,
                  sourceName: payload.sourceName,
                  location: payload.headingPath,
                  confidence: "high",
                  quote: "27% drop in unsupported factual statements",
                  evidenceType: "supporting",
                },
              ]
            : payload.chunkText.toLowerCase().includes("benefits shrink")
              ? [
                  {
                    claim: "Retrieval gains weaken when retrieval coverage is poor or stale.",
                    sourceId: payload.sourceId,
                    sourceName: payload.sourceName,
                    location: payload.headingPath,
                    confidence: "medium",
                    quote: "Benefits shrink when retrieval misses long-tail tickets",
                    evidenceType: "methodological",
                  },
                ]
              : [
                  {
                    claim: "RAG effectiveness depends on relevant, current grounding material.",
                    sourceId: payload.sourceId,
                    sourceName: payload.sourceName,
                    location: payload.headingPath,
                    confidence: "medium",
                    quote: "retrieval grounding improves factual precision",
                    evidenceType: "neutral",
                  },
                ];

        return {
          data: { items },
          raw: emptyRawResponse(),
        };
      }

      if (schemaName === "consolidated_findings") {
        const payload = JSON.parse(userContent) as {
          evidenceMap: {
            supportingEvidence: Array<Record<string, unknown>>;
            contradictoryEvidence: Array<Record<string, unknown>>;
            methodologicalCautions: Array<Record<string, unknown>>;
          };
        };

        return {
          data: {
            canonicalClaims: [
              {
                claim:
                  "RAG reduces hallucinations when retrieval quality is high, but stale or incomplete corpora leave material failure modes.",
                support: payload.evidenceMap.supportingEvidence,
                contradictions: payload.evidenceMap.contradictoryEvidence,
                confidence: "medium-high",
              },
            ],
            prioritizedSupport: payload.evidenceMap.supportingEvidence,
            prioritizedContradictions: payload.evidenceMap.contradictoryEvidence,
            openQuestions: [
              "How much retrieval freshness is required to preserve the gains in enterprise environments?",
            ],
            confidenceNotes: [
              "Evidence is directionally consistent but depends on retrieval quality assumptions.",
            ],
            unresolvedDisagreements: [],
          },
          raw: emptyRawResponse(),
        };
      }

      throw new Error(`Unhandled JSON schema in forensic harness: ${schemaName}`);
    },
    callLLM: async (options: { messages: Array<{ role: string; content: string }> }) => {
      llmArtifactCalls += 1;
      const userContent =
        options.messages.find((message) => message.role === "user")?.content ?? "";

      if (userContent.includes('"sourceName"')) {
        const payload = JSON.parse(userContent) as { sourceName: string };
        return {
          ...emptyRawResponse(),
          content: `# ${payload.sourceName}\n\nThis source supports the forensic integration scenario.`,
        };
      }

      return {
        ...emptyRawResponse(),
        content: `Generated artifact ${llmArtifactCalls}`,
      };
    },
  });

  global.fetch = (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    fetchUrls.push(url);

    if (url === "https://example.test/rag-reliability.pdf?download=1") {
      return new Response(Buffer.from("%PDF-1.7 forensic-discovered-pdf"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }

    if (url === "https://example.test/support-copilot-report") {
      return new Response(
        `<html><body><main>
          <h1>Support Copilot Field Report</h1>
          <p>Enterprise teams saw more reliable answers when retrieval was grounded in fresh runbooks and ticket history.</p>
          <p>However, stale indexes and missing long-tail incident documents still produced unsupported answers.</p>
          <p>Teams reported that careful corpus maintenance remained necessary even after retrieval grounding was deployed.</p>
          <p>This report provides enough text to pass normalization and chunking for the forensic test harness by repeating the operational findings with more narrative detail.</p>
          <p>In the strongest deployments, analysts used retrieved passages directly in the answer composer and logged evidence links for every recommendation returned to the support agent.</p>
          <p>In weaker deployments, retrieval occasionally returned stale documents, duplicate tickets, or partial runbooks, which left the model with insufficient grounding and allowed residual unsupported claims.</p>
          <p>Several teams also noted that retrieval quality varied dramatically across long-tail incident classes, especially when documentation ownership was fragmented across product teams.</p>
          <p>These observations make the report long enough to survive validation while preserving a realistic enterprise-support narrative for the forensic harness.</p>
        </main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      );
    }

    if (url === "https://example.test/rag-reliability") {
      return new Response(
        `<html><body><main><p>Fallback HTML should not be used because the PDF candidate succeeds first.</p></main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      );
    }

    throw new Error(`Unexpected fetch URL in forensic harness: ${url}`);
  }) as typeof fetch;

  clearRuntimeModules();

  try {
    const uploadRoute = reloadModule<RouteModule<typeof import("../../app/api/upload/route")>>(
      "../../app/api/upload/route.ts"
    );
    const initRoute = reloadModule<RouteModule<typeof import("../../app/api/init/route")>>(
      "../../app/api/init/route.ts"
    );
    const confirmRoute = reloadModule<
      RouteModule<typeof import("../../app/api/init/[runId]/confirm/route")>
    >("../../app/api/init/[runId]/confirm/route.ts");
    const statusRoute = reloadModule<RouteModule<typeof import("../../app/api/init/[runId]/route")>>(
      "../../app/api/init/[runId]/route.ts"
    );
    const graphModule = requireFrom(
      "../../lib/engine/graph.ts"
    ) as typeof import("../../lib/engine/graph");

    const formData = new FormData();
    formData.append(
      "files",
      new File([Buffer.from("%PDF-1.7 uploaded forensic file")], "uploaded-rag-study.pdf", {
        type: "application/pdf",
      })
    );

    const uploadResponse = await uploadRoute.POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      }) as never
    );
    const uploadBody = (await uploadResponse.json()) as {
      sources: Array<Record<string, unknown>>;
    };

    const initResponse = await initRoute.POST(
      new Request("http://localhost/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: DEFAULT_TEST_INPUT,
          sources: uploadBody.sources,
        }),
      }) as never
    );
    const initBody = (await initResponse.json()) as {
      runId: string;
      projectId: string;
      status: string;
      perspective: { briefSummary: string };
    };

    const confirmResponse = await confirmRoute.POST(
      new Request(`http://localhost/api/init/${initBody.runId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }) as never,
      { params: Promise.resolve({ runId: initBody.runId }) }
    );
    const confirmBody = (await confirmResponse.json()) as { status: string };

    let finalStatusBody: {
      status: string;
      currentStep: string;
      errors?: unknown[];
      progress?: Array<Record<string, unknown>>;
    } | null = null;
    let polls = 0;

    for (; polls < 100; polls += 1) {
      const statusResponse = await statusRoute.GET(
        new Request(`http://localhost/api/init/${initBody.runId}`) as never,
        { params: Promise.resolve({ runId: initBody.runId }) }
      );
      const statusBody = (await statusResponse.json()) as {
        status: string;
        currentStep: string;
        errors?: unknown[];
        progress?: Array<Record<string, unknown>>;
      };
      finalStatusBody = statusBody;
      if (["completed", "partial", "failed"].includes(statusBody.status)) {
        break;
      }
      await sleep(20);
    }

    if (!finalStatusBody) {
      throw new Error("Forensic harness did not receive a status response");
    }

    const snapshot = await graphModule.initGraph.getState({
      configurable: { thread_id: initBody.runId },
    });
    const state = snapshot.values as {
      sources?: Array<Record<string, unknown>>;
      parsedSources?: Array<Record<string, unknown>>;
      sourceChunks?: Array<Record<string, unknown>>;
      evidenceMap?: {
        supportingEvidence?: unknown[];
        contradictoryEvidence?: unknown[];
        methodologicalCautions?: unknown[];
      };
      artifacts?: Record<string, unknown> & { sources?: Record<string, string> };
    };

    const persistedRun = persistedRuns.get(initBody.runId);
    const persistedProject = initBody.projectId
      ? persistedProjects.get(initBody.projectId)
      : undefined;
    const persistedArtifactsRecord = persistedArtifacts.get(initBody.runId);

    const invariants: ForensicInvariantReport = { passed: [], failed: [] };
    checkInvariant(invariants, uploadResponse.status === 200, "Upload route accepted the test PDF");
    checkInvariant(
      invariants,
      (uploadBody.sources?.length ?? 0) === 1,
      "Upload route returned exactly one uploaded source"
    );
    checkInvariant(
      invariants,
      initBody.status === "awaiting_confirmation",
      "Init route paused at perspective confirmation"
    );
    checkInvariant(
      invariants,
      confirmBody.status === "running",
      "Confirm route resumed the graph in background mode"
    );
    checkInvariant(
      invariants,
      finalStatusBody.status === "completed",
      "Pipeline reached a completed terminal state"
    );
    checkInvariant(
      invariants,
      (finalStatusBody.errors?.length ?? 0) === 0,
      "Final status reported no run errors"
    );
    checkInvariant(
      invariants,
      (state.sources?.length ?? 0) === 3,
      "Final state retained the uploaded source plus two discovered sources"
    );
    checkInvariant(
      invariants,
      (state.parsedSources?.length ?? 0) === 3,
      "All three sources were normalized successfully"
    );
    checkInvariant(
      invariants,
      (state.sourceChunks?.length ?? 0) >= 3,
      "Normalized sources were chunked before evidence analysis"
    );
    checkInvariant(
      invariants,
      !!state.artifacts?.overview &&
        !!state.artifacts?.synthesis &&
        !!state.artifacts?.claims &&
        !!state.artifacts?.gaps &&
        !!state.artifacts?.nextSteps,
      "Core deliverables were generated"
    );
    checkInvariant(
      invariants,
      (Object.keys(state.artifacts?.sources ?? {}).length ?? 0) === 3,
      "Per-source summaries were generated for every parsed source"
    );
    checkInvariant(
      invariants,
      (persistedArtifactsRecord?.sources.length ?? 0) === 3,
      "Persistence captured all source metadata rows"
    );
    checkInvariant(
      invariants,
      (persistedArtifactsRecord?.sourceChunks.length ?? 0) ===
        (state.sourceChunks?.length ?? 0),
      "Persistence captured every source chunk manifest"
    );

    return {
      passed: invariants.failed.length === 0,
      flowMap:
        "POST /api/upload -> POST /api/init -> initGraph.invoke -> interrupt(confirm_inferred_brief) -> POST /api/init/[runId]/confirm -> initGraph.invoke(resume) -> GET /api/init/[runId]",
      input: DEFAULT_TEST_INPUT,
      upload: {
        status: uploadResponse.status,
        sourceCount: uploadBody.sources.length,
        sourceIds: uploadBody.sources.map((source) => String(source.sourceId)),
      },
      init: {
        statusCode: initResponse.status,
        status: initBody.status,
        runId: initBody.runId,
        projectId: initBody.projectId,
        perspectiveSummary: initBody.perspective?.briefSummary ?? "",
      },
      confirm: {
        statusCode: confirmResponse.status,
        status: confirmBody.status,
      },
      finalStatus: {
        statusCode: 200,
        status: finalStatusBody.status,
        currentStep: finalStatusBody.currentStep,
        errorCount: finalStatusBody.errors?.length ?? 0,
        progress: finalStatusBody.progress ?? [],
        polls: polls + 1,
      },
      finalState: {
        sourceCount: state.sources?.length ?? 0,
        parsedSourceCount: state.parsedSources?.length ?? 0,
        sourceChunkCount: state.sourceChunks?.length ?? 0,
        supportingEvidenceCount: state.evidenceMap?.supportingEvidence?.length ?? 0,
        contradictoryEvidenceCount: state.evidenceMap?.contradictoryEvidence?.length ?? 0,
        methodologicalCautionCount:
          state.evidenceMap?.methodologicalCautions?.length ?? 0,
        artifactKeys: Object.keys(state.artifacts ?? {}).filter((key) => key !== "sources"),
        sourceSummaryCount: Object.keys(state.artifacts?.sources ?? {}).length,
      },
      persisted: {
        runStatus: persistedRun?.status ?? "missing",
        projectStatus: persistedProject?.status ?? "missing",
        persistedSourceCount: persistedArtifactsRecord?.sources.length ?? 0,
        persistedChunkCount: persistedArtifactsRecord?.sourceChunks.length ?? 0,
        persistedArtifactKeys: Object.keys(persistedArtifactsRecord?.artifacts ?? {}),
      },
      traces: {
        generatedIds,
        fetchUrls,
        parsedPdfFiles,
        llmJsonSchemas,
        llmArtifactCalls,
      },
      invariants,
    };
  } finally {
    global.fetch = originalFetch;
    restoreOpenrouter();
    restorePdfParser();
    restoreDiscovery();
    restoreResearchProjects();
    restoreSession();
    restoreIds();
    await rm(tempBlobRoot, { recursive: true, force: true });
    restoreEnv(previousEnv);
    resetRuntimeSingletons();
  }
}

function emptyRawResponse() {
  return {
    content: "",
    model: "forensic-mock-model",
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    latencyMs: 0,
  };
}

function buildMockPdfText(filename: string) {
  return [
    "# Abstract",
    "",
    `${filename} reports that retrieval grounding improves factual precision when documents are current, ranked well, and attached directly to the model response pathway.`,
    `${filename} also argues that enterprise support settings remain sensitive to stale indexes, fragmented documentation ownership, and long-tail incident coverage gaps.`,
    "",
    "# Results",
    "",
    "The study finds a 27% drop in unsupported factual statements when retrieved evidence is cited inline and when the retrieval layer enforces document freshness constraints.",
    "It also reports that answer quality gains are strongest when retrieval coverage spans the top operational runbooks, incident retrospectives, and product change logs used by support teams.",
    "",
    "# Limitations",
    "",
    "Benefits shrink when retrieval misses long-tail tickets or stale documentation remains in the corpus, especially when the model is forced to answer despite weak grounding.",
    "The authors caution that retrieval quality management, document freshness, and missing-corpus analysis remain necessary if teams expect durable hallucination reductions in production.",
  ].join("\n");
}

function checkInvariant(
  report: ForensicInvariantReport,
  condition: boolean,
  message: string
) {
  if (condition) {
    report.passed.push(message);
    return;
  }
  report.failed.push(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearRuntimeModules() {
  for (const modulePath of [
    "../../app/api/upload/route.ts",
    "../../app/api/init/route.ts",
    "../../app/api/init/[runId]/confirm/route.ts",
    "../../app/api/init/[runId]/route.ts",
    "../../lib/engine/graph.ts",
    "../../lib/engine/nodes/build-source-set.ts",
    "../../lib/engine/nodes/analyze-evidence.ts",
    "../../lib/engine/nodes/consolidate-findings.ts",
    "../../lib/engine/nodes/synthesize-project.ts",
    "../../lib/engine/nodes/persist-project.ts",
    "../../lib/engine/nodes/infer-user-perspective.ts",
    "../../lib/engine/nodes/confirm-inferred-brief.ts",
    "../../lib/ingest/source-ingestion.ts",
    "../../lib/storage/blob-store.ts",
    "../../lib/storage/memory-store.ts",
  ]) {
    clearModule(modulePath);
  }
}

function resetRuntimeSingletons() {
  delete (globalThis as typeof globalThis & {
    __tenetBlobStore?: unknown;
    __tenetMemoryStore?: unknown;
    __tenetInitGraphCheckpointer?: unknown;
  }).__tenetBlobStore;
  delete (globalThis as typeof globalThis & {
    __tenetBlobStore?: unknown;
    __tenetMemoryStore?: unknown;
    __tenetInitGraphCheckpointer?: unknown;
  }).__tenetMemoryStore;
  delete (globalThis as typeof globalThis & {
    __tenetBlobStore?: unknown;
    __tenetMemoryStore?: unknown;
    __tenetInitGraphCheckpointer?: unknown;
  }).__tenetInitGraphCheckpointer;
}

function restoreEnv(previousEnv: {
  LOCAL_BLOB_ROOT?: string;
  OPENROUTER_API_KEY?: string;
}) {
  if (previousEnv.LOCAL_BLOB_ROOT === undefined) {
    delete process.env.LOCAL_BLOB_ROOT;
  } else {
    process.env.LOCAL_BLOB_ROOT = previousEnv.LOCAL_BLOB_ROOT;
  }

  if (previousEnv.OPENROUTER_API_KEY === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = previousEnv.OPENROUTER_API_KEY;
  }
}

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
}

function clearModule(modulePath: string) {
  try {
    const resolved = requireFrom.resolve(modulePath);
    delete requireFrom.cache[resolved];
  } catch {
    // Ignore modules that were never loaded in this process.
  }
}

function patchModule(modulePath: string, exports: unknown): () => void {
  const resolved = requireFrom.resolve(modulePath);
  const original = requireFrom.cache[resolved];

  if (!original) {
    requireFrom(modulePath);
  }

  requireFrom.cache[resolved]!.exports = exports;

  return () => {
    if (original) {
      requireFrom.cache[resolved] = original;
      return;
    }

    delete requireFrom.cache[resolved];
  };
}
