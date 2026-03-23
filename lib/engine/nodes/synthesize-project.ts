import type { InitRunState, InitRunUpdate, Artifacts } from "../state";
import { callLLM } from "@/lib/llm/openrouter";
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

  const context = JSON.stringify(
    { input, perspective, consolidatedFindings },
    null,
    2
  );

  const parsed = parsedSources ?? [];

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
        maxTokens: 4096,
      }),
      callLLM({
        model: MODEL,
        messages: [
          { role: "system", content: buildSynthesisPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 16384,
        temperature: 0.3,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildClaimsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 8192,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildGapsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 4096,
      }),
      callLLM({
        model: MODEL_LIGHT,
        messages: [
          { role: "system", content: buildNextStepsPrompt() },
          { role: "user", content: context },
        ],
        maxTokens: 4096,
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
