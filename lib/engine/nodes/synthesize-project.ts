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

const MAX_CONCURRENT_SOURCE_SUMMARIES = 8;

export async function synthesizeProject(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, input, perspective, consolidatedFindings, parsedSources, sources } =
    state;

  memoryStore.updateProgress(runId, "synthesize_project", {
    status: "running",
    detail: "Writing overview, synthesis, claims, gaps, and next steps...",
    subSteps: [
      { label: "Core deliverables (5 files)", status: "running" },
      { label: "Per-source summaries", status: "pending" },
    ],
  });

  if (!consolidatedFindings || !perspective) {
    return {
      errors: [
        {
          step: "synthesize_project",
          message: "Missing consolidated findings or perspective",
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

  // Generate 5 core artifacts in parallel
  const [overviewRes, synthesisRes, claimsRes, gapsRes, nextStepsRes] =
    await Promise.all([
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
    ]);

  // Generate per-source summaries in parallel
  memoryStore.updateProgress(runId, "synthesize_project", {
    detail: `Writing per-source summaries for ${(parsedSources ?? []).length} sources...`,
    subSteps: [
      { label: "Core deliverables (5 files)", status: "completed" },
      { label: "Per-source summaries", status: "running" },
    ],
  });

  const parsed = parsedSources ?? [];
  const sourceSummaries: Record<string, string> = {};

  const sourceResults = await allSettledWithConcurrency(
    parsed,
    MAX_CONCURRENT_SOURCE_SUMMARIES,
    async (ps) => {
      const src = sources.find((s) => s.sourceId === ps.sourceId);
      const normalizedText = await blobStore.getText(ps.normalizedBlobKey);
      const result = await callLLM({
        model: MODEL_LITE,
        messages: [
          { role: "system", content: buildSourceSummaryPrompt() },
          {
            role: "user",
            content: JSON.stringify({
              sourceName: src?.name ?? ps.name,
              content: normalizedText.slice(0, 30000),
              perspective,
            }),
          },
        ],
        maxTokens: 4096,
      });
      return { sourceId: ps.sourceId, markdown: result.content };
    }
  );

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
