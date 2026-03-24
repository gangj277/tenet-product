import type {
  ClaimFamily,
  ConsolidatedFindings,
  EvidenceItem,
  InitRunState,
  InitRunUpdate,
  RunError,
  SourceDigest,
} from "../state";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL, MODEL_LITE } from "@/lib/llm/models";
import {
  buildBatchFindingsMergePrompt,
  buildClaimFamilyBatchPrompt,
  buildClusterConsolidationPrompt,
  buildFinalFindingsMergePrompt,
} from "../prompts/consolidation";
import { memoryStore } from "@/lib/storage/memory-store";
import {
  reduceAndClusterEvidence,
  toCompactClusterPayload,
} from "../consolidation/reduce-and-cluster";
import {
  batchClaimFamilies,
  buildClaimFamilies,
} from "../consolidation/claim-families";
import { allSettledWithConcurrency } from "@/lib/utils/async";

const MAX_CONCURRENT_CLUSTER_CONSOLIDATIONS = 8;
const MAX_CONCURRENT_BATCH_ADJUDICATIONS = 6;

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

const CLUSTER_CONSOLIDATION_SCHEMA = {
  name: "cluster_consolidation",
  schema: {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      canonicalClaim: { type: "string" },
      support: {
        type: "array",
        items: EVIDENCE_ITEM_SCHEMA,
      },
      contradictions: {
        type: "array",
        items: EVIDENCE_ITEM_SCHEMA,
      },
      confidence: { type: "string" },
      openQuestions: {
        type: "array",
        items: { type: "string" },
      },
      confidenceNotes: {
        type: "array",
        items: { type: "string" },
      },
      unresolvedDisagreements: {
        type: "array",
        items: { type: "string" },
      },
      methodologicalCautions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "clusterId",
      "canonicalClaim",
      "support",
      "contradictions",
      "confidence",
      "openQuestions",
      "confidenceNotes",
      "unresolvedDisagreements",
      "methodologicalCautions",
    ],
    additionalProperties: false,
  },
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

const CLAIM_FAMILY_BATCH_SCHEMA = {
  name: "claim_family_batch",
  schema: CONSOLIDATED_FINDINGS_SCHEMA.schema,
} as const;

interface ClusterConsolidation {
  clusterId: string;
  canonicalClaim: string;
  support: EvidenceItem[];
  contradictions: EvidenceItem[];
  confidence: string;
  openQuestions: string[];
  confidenceNotes: string[];
  unresolvedDisagreements: string[];
  methodologicalCautions: string[];
}

export async function consolidateFindings(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, perspective, sourceDigests } = state;

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: "Grouping claim families and adjudicating findings...",
    subSteps: [
      { label: "Grouping claim families", status: "running" },
      { label: "Adjudicating family batches", status: "pending" },
      { label: "Merging canonical findings", status: "pending" },
    ],
  });

  if (!perspective) {
    return failConsolidation("Missing perspective");
  }

  try {
    if ((sourceDigests?.length ?? 0) > 0) {
      return await consolidateFromSourceDigests(state, sourceDigests);
    }

    return await consolidateFromEvidenceMap(state);
  } catch (err) {
    console.error("[consolidate] Error:", (err as Error).message);
    return failConsolidation((err as Error).message);
  }
}

async function consolidateFromSourceDigests(
  state: InitRunState,
  sourceDigests: SourceDigest[]
): Promise<InitRunUpdate> {
  const { runId, perspective } = state;
  const claimFamilies =
    state.claimFamilies && state.claimFamilies.length > 0
      ? state.claimFamilies
      : buildClaimFamilies(sourceDigests);

  if (claimFamilies.length === 0) {
    throw new Error("No claim families were produced from the source digests");
  }

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: `Grouped ${sourceDigests.length} source digests into ${claimFamilies.length} claim families`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "running" },
      { label: "Merging canonical findings", status: "pending" },
    ],
  });

  const batches = batchClaimFamilies(claimFamilies);
  const batchSettled = await allSettledWithConcurrency(
    batches,
    MAX_CONCURRENT_BATCH_ADJUDICATIONS,
    async (batch) => {
      const { data } = await callLLMJson<ConsolidatedFindings>({
        model: MODEL_LITE,
        messages: [
          { role: "system", content: buildClaimFamilyBatchPrompt() },
          {
            role: "user",
            content: JSON.stringify(
              {
                perspective,
                batchId: batch.batchId,
                subquestion: batch.subquestion,
                families: batch.families.map(toClaimFamilyPayload),
              },
              null,
              2
            ),
          },
        ],
        temperature: 0.2,
        maxTokens: 4096,
        jsonSchema: CLAIM_FAMILY_BATCH_SCHEMA,
      });

      return data;
    }
  );

  const errors: RunError[] = [];
  const batchSummaries: ConsolidatedFindings[] = [];
  for (const result of batchSettled) {
    if (result.status === "fulfilled") {
      batchSummaries.push(result.value);
      continue;
    }

    errors.push({
      step: "consolidate_findings",
      message:
        (result.reason as Error)?.message ?? "Claim-family batch adjudication failed",
      retryable: true,
      timestamp: new Date().toISOString(),
    });
  }

  if (batchSummaries.length === 0) {
    throw new Error("Every claim-family batch adjudication failed");
  }

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: `Adjudicated ${batchSummaries.length} batch summaries into canonical findings...`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "completed" },
      { label: "Merging canonical findings", status: "running" },
    ],
  });

  let consolidatedFindings: ConsolidatedFindings;
  if (batchSummaries.length === 1) {
    consolidatedFindings = batchSummaries[0]!;
  } else {
    const { data } = await callLLMJson<ConsolidatedFindings>({
      model: MODEL,
      messages: [
        { role: "system", content: buildBatchFindingsMergePrompt() },
        {
          role: "user",
          content: JSON.stringify(
            {
              perspective,
              batchSummaries,
            },
            null,
            2
          ),
        },
      ],
      temperature: 0.2,
      maxTokens: 16384,
      jsonSchema: CONSOLIDATED_FINDINGS_SCHEMA,
    });
    consolidatedFindings = data;
  }

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "completed",
    detail: `${consolidatedFindings.canonicalClaims.length} canonical claims consolidated`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "completed" },
      { label: "Merging canonical findings", status: "completed" },
    ],
  });

  return {
    claimFamilies,
    consolidatedFindings,
    currentStep: "consolidate_findings",
    errors,
  };
}

async function consolidateFromEvidenceMap(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, evidenceMap, perspective } = state;

  if (!evidenceMap || !perspective) {
    throw new Error("Missing evidence map or perspective");
  }

  const reduction = reduceAndClusterEvidence({ evidenceMap, perspective });

  if (reduction.clusters.length === 0) {
    throw new Error("No claim clusters were produced from the extracted evidence");
  }

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: `Reduced ${reduction.uniqueEvidence.length} evidence items into ${reduction.clusters.length} claim clusters`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "running" },
      { label: "Merging canonical findings", status: "pending" },
    ],
  });

  const clusterSystemPrompt = buildClusterConsolidationPrompt();
  const clusterSettled = await allSettledWithConcurrency(
    reduction.clusters,
    MAX_CONCURRENT_CLUSTER_CONSOLIDATIONS,
    async (cluster) => {
      const compactCluster = toCompactClusterPayload(cluster);
      const { data } = await callLLMJson<ClusterConsolidation>({
        model: MODEL_LITE,
        messages: [
          { role: "system", content: clusterSystemPrompt },
          {
            role: "user",
            content: JSON.stringify({ perspective, cluster: compactCluster }, null, 2),
          },
        ],
        temperature: 0.2,
        maxTokens: 4096,
        jsonSchema: CLUSTER_CONSOLIDATION_SCHEMA,
      });
      return data;
    }
  );

  const clusterSummaries: ClusterConsolidation[] = [];
  const errors: RunError[] = [];
  for (const result of clusterSettled) {
    if (result.status === "fulfilled") {
      clusterSummaries.push(result.value);
      continue;
    }

    errors.push({
      step: "consolidate_findings",
      message:
        (result.reason as Error)?.message ?? "Cluster consolidation failed",
      retryable: true,
      timestamp: new Date().toISOString(),
    });
  }

  if (clusterSummaries.length === 0) {
    throw new Error("Every claim-cluster consolidation failed");
  }

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "running",
    detail: `Merged ${clusterSummaries.length} cluster summaries into canonical findings...`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "completed" },
      { label: "Merging canonical findings", status: "running" },
    ],
  });

  const mergePayload = JSON.stringify(
    {
      perspective,
      reductionSummary: {
        uniqueEvidenceCount: reduction.uniqueEvidence.length,
        duplicateEvidenceCount: reduction.duplicateCount,
        clusterCount: reduction.clusters.length,
        successfulClusterSummaries: clusterSummaries.length,
      },
      clusterSummaries,
    },
    null,
    2
  );

  const { data } = await callLLMJson<ConsolidatedFindings>({
    model: MODEL,
    messages: [
      { role: "system", content: buildFinalFindingsMergePrompt() },
      { role: "user", content: mergePayload },
    ],
    temperature: 0.2,
    maxTokens: 16384,
    jsonSchema: CONSOLIDATED_FINDINGS_SCHEMA,
  });

  memoryStore.updateProgress(runId, "consolidate_findings", {
    status: "completed",
    detail: `${data.canonicalClaims?.length ?? 0} canonical claims consolidated`,
    subSteps: [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "completed" },
      { label: "Merging canonical findings", status: "completed" },
    ],
  });

  return {
    consolidatedFindings: data,
    currentStep: "consolidate_findings",
    errors,
  };
}

function failConsolidation(message: string): InitRunUpdate {
  return {
    status: "failed",
    currentStep: "consolidate_findings",
    errors: [
      {
        step: "consolidate_findings",
        message,
        retryable: true,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function toClaimFamilyPayload(family: ClaimFamily) {
  return {
    familyId: family.familyId,
    claimSignature: family.claimSignature,
    representativeClaim: family.representativeClaim,
    subquestion: family.subquestion,
    sourceIds: family.sourceIds,
    support: family.supportingEvidence,
    contradictions: family.contradictoryEvidence,
    neutralEvidence: family.neutralEvidence,
    methodologicalNotes: family.methodologicalNotes,
    caveats: family.caveats,
  };
}
