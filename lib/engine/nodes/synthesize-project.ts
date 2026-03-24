import type { InitRunState, InitRunUpdate, Artifacts } from "../state";
import { callLLM } from "@/lib/llm/runtime";
import { MODEL, MODEL_LIGHT, MODEL_LITE } from "@/lib/llm/models";
import { memoryStore } from "@/lib/storage/memory-store";
import { blobStore } from "@/lib/storage/blob-store";
import { allSettledWithConcurrency } from "@/lib/utils/async";
import {
  buildOverviewPrompt,
  buildSynthesisPrompt,
  buildClaimsPrompt,
  buildGapsPrompt,
  buildNextStepsPrompt,
  buildSourceSummaryPrompt,
} from "../prompts/synthesis-writing";

const MAX_CONCURRENT_SOURCE_SUMMARIES = 20;

function buildSourceBase(
  sources: InitRunState["sources"],
  parsedSourceCount: number
) {
  return {
    totalSources: sources.length,
    parsedSources: parsedSourceCount,
    uploadedSources: sources.filter((source) => source.origin === "uploaded").length,
    discoveredSources: sources.filter((source) => source.origin === "discovered").length,
  };
}

export async function synthesizeProject(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, input, perspective, consolidatedFindings, parsedSources, sources } =
    state;

  memoryStore.updateProgress(runId, "synthesize_project", {
    status: "running",
    detail: "Writing core deliverables and per-source summaries...",
    subSteps: [
      { label: "Core deliverables (5 files)", status: "running" },
      { label: "Per-source summaries", status: "running" },
    ],
  });

  if (!consolidatedFindings || !perspective) {
    console.error(`[synthesize] Missing data — perspective: ${!!perspective}, consolidatedFindings: ${!!consolidatedFindings}`);
    return {
      errors: [
        {
          step: "synthesize_project",
          message: `Missing ${!perspective ? "perspective" : ""}${!perspective && !consolidatedFindings ? " and " : ""}${!consolidatedFindings ? "consolidated findings" : ""}`,
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const parsed = parsedSources ?? [];
  const context = JSON.stringify(
    {
      input,
      perspective,
      consolidatedFindings,
      sourceBase: buildSourceBase(sources, parsed.length),
    },
    null,
    2
  );

  // Pre-fetch all normalized texts before concurrent LLM calls (avoids I/O inside workers)
  const sourceTexts = await Promise.all(
    parsed.map((ps) => blobStore.getText(ps.normalizedBlobKey))
  );

  // Run core artifacts AND source summaries concurrently — both depend only on
  // consolidatedFindings + perspective, not on each other.
  const [
    [overviewRes, synthesisRes, claimsRes, gapsRes, nextStepsRes],
    sourceResults,
  ] = await Promise.all([
    // 5 core artifacts
    Promise.all([
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildOverviewPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 1200,
      }),
      callLLM({
        model: MODEL,
        messages: [
          { role: "system", content: buildSynthesisPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 5120,
        temperature: 0.2,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildClaimsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 3072,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildGapsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 2048,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildNextStepsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 1536,
      }),
    ]),
    // Per-source summaries (using pre-fetched texts)
    allSettledWithConcurrency(
      parsed.map((ps, i) => ({ ps, text: sourceTexts[i] })),
      MAX_CONCURRENT_SOURCE_SUMMARIES,
      async ({ ps, text }) => {
        const src = sources.find((s) => s.sourceId === ps.sourceId);
        const result = await callLLM({
          model: MODEL_LITE,
          messages: [
            { role: "system", content: buildSourceSummaryPrompt() },
            {
              role: "user",
              content: JSON.stringify({
                sourceName: src?.name ?? ps.name,
                content: text.slice(0, 30000),
                perspective,
              }),
            },
          ],
          maxTokens: 4096,
        });
        return { sourceId: ps.sourceId, markdown: result.content };
      }
    ),
  ]);

  const sourceSummaries: Record<string, string> = {};
  for (const r of sourceResults) {
    if (r.status === "fulfilled") {
      sourceSummaries[r.value.sourceId] = r.value.markdown;
    }
  }

  const artifacts: Artifacts = {
    overview: overviewRes.content,
    synthesis: synthesisRes.content,
    claims: claimsRes.content,
    gaps: gapsRes.content,
    nextSteps: nextStepsRes.content,
    sources: sourceSummaries,
    papers: {},
    notes: {},
    experiments: {},
  };

  memoryStore.updateProgress(runId, "synthesize_project", {
    status: "completed",
    detail: "All deliverables written",
    subSteps: [
      { label: "Core deliverables (5 files)", status: "completed" },
      { label: "Per-source summaries", status: "completed" },
    ],
  });

  return {
    artifacts,
    currentStep: "synthesize_project",
  };
}
