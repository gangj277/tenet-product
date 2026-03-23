import type {
  InitRunState,
  InitRunUpdate,
  ConsolidatedFindings,
} from "../state";
import { callLLMJson } from "@/lib/llm/openrouter";
import { MODEL } from "@/lib/llm/models";
import { buildConsolidationPrompt } from "../prompts/consolidation";
import { memoryStore } from "@/lib/storage/memory-store";

const EVIDENCE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    claim: { type: "string" },
    sourceId: { type: "string" },
    sourceName: { type: "string" },
    location: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    quote: { type: "string" },
  },
  required: ["claim", "sourceId", "sourceName", "location", "confidence", "quote"],
  additionalProperties: false,
} as const;

const CONSOLIDATED_FINDINGS_SCHEMA = {
  name: "consolidated_findings",
  schema: {
    type: "object",
    properties: {
      canonicalClaims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "The canonical claim statement" },
            support: { type: "array", items: EVIDENCE_ITEM_SCHEMA, description: "Supporting evidence" },
            contradictions: { type: "array", items: EVIDENCE_ITEM_SCHEMA, description: "Contradicting evidence" },
            confidence: { type: "string", description: "Overall confidence in this claim" },
          },
          required: ["claim", "support", "contradictions", "confidence"],
          additionalProperties: false,
        },
      },
      prioritizedSupport: {
        type: "array",
        items: EVIDENCE_ITEM_SCHEMA,
        description: "Top supporting evidence ranked by importance",
      },
      prioritizedContradictions: {
        type: "array",
        items: EVIDENCE_ITEM_SCHEMA,
        description: "Top contradictory evidence ranked by importance",
      },
      openQuestions: {
        type: "array",
        items: { type: "string" },
        description: "Questions that remain unanswered by the evidence",
      },
      confidenceNotes: {
        type: "array",
        items: { type: "string" },
        description: "Notes about overall confidence and evidence quality",
      },
      unresolvedDisagreements: {
        type: "array",
        items: { type: "string" },
        description: "Disagreements between sources that could not be resolved",
      },
    },
    required: [
      "canonicalClaims",
      "prioritizedSupport",
      "prioritizedContradictions",
      "openQuestions",
      "confidenceNotes",
      "unresolvedDisagreements",
    ],
    additionalProperties: false,
  },
} as const;

export async function consolidateFindings(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, evidenceMap, perspective } = state;

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: "Cross-referencing claims and resolving contradictions...",
  });

  if (!evidenceMap || !perspective) {
    return {
      errors: [
        {
          step: "consolidate_findings",
          message: "Missing evidence map or perspective",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  try {
    const systemPrompt = buildConsolidationPrompt();

    // Strip personaFindings — it duplicates items already in the top-level arrays
    // and wastes context tokens that the model needs for producing thorough output.
    const { personaFindings: _, ...evidenceForConsolidation } = evidenceMap;

    const userContent = JSON.stringify(
      { perspective, evidenceMap: evidenceForConsolidation },
      null,
      2
    );

    const { data } = await callLLMJson<ConsolidatedFindings>({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      maxTokens: 16384,
      jsonSchema: CONSOLIDATED_FINDINGS_SCHEMA,
    });

    const claimCount = data.canonicalClaims?.length ?? 0;
    memoryStore.updateProgress(runId, "consolidate_findings", {
      status: "completed",
      detail: `${claimCount} canonical claims consolidated`,
    });

    return {
      consolidatedFindings: data,
      currentStep: "consolidate_findings",
    };
  } catch (err) {
    console.error("[consolidate] Error:", (err as Error).message);
    memoryStore.updateProgress(runId, "consolidate_findings", { status: "failed" });
    return {
      errors: [
        {
          step: "consolidate_findings",
          message: (err as Error).message,
          retryable: true,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
