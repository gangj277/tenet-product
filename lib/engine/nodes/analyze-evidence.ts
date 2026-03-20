import type {
  EvidenceItem,
  EvidenceMap,
  InitRunState,
  InitRunUpdate,
  ParsedSource,
  RunError,
  SourceChunk,
} from "../state";
import { callLLMJson } from "@/lib/llm/openrouter";
import { MODEL_LITE } from "@/lib/llm/models";
import { memoryStore } from "@/lib/storage/memory-store";
import { blobStore } from "@/lib/storage/blob-store";
import { allSettledWithConcurrency } from "@/lib/utils/async";

const MAX_CONCURRENT_CHUNK_EXTRACTIONS = 30;

const CHUNK_EVIDENCE_SCHEMA = {
  name: "chunk_evidence_items",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim: { type: "string" },
            sourceId: { type: "string" },
            sourceName: { type: "string" },
            location: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            quote: { type: "string" },
            evidenceType: {
              type: "string",
              enum: ["supporting", "contradictory", "methodological", "neutral"],
            },
          },
          required: [
            "claim",
            "sourceId",
            "sourceName",
            "location",
            "confidence",
            "quote",
            "evidenceType",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
} as const;

export async function analyzeEvidence(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, perspective, parsedSources, sourceChunks } = state;

  if (!perspective || !parsedSources?.length || !sourceChunks?.length) {
    return {
      errors: [
        {
          step: "analyze_evidence",
          message: "Missing perspective, parsed sources, or source chunks",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const parsedSourceMap = new Map(parsedSources.map((source) => [source.sourceId, source]));
  const chunksToAnalyze = sourceChunks.filter((chunk) =>
    parsedSourceMap.has(chunk.sourceId)
  );

  if (chunksToAnalyze.length === 0) {
    return {
      errors: [
        {
          step: "analyze_evidence",
          message: "No analyzed chunks were available after source ingestion",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  memoryStore.updateProgress(runId, "analyze_evidence", {
    status: "running",
    detail: `Extracting evidence from ${chunksToAnalyze.length} bounded chunks across ${parsedSources.length} sources...`,
  });

  const perspectiveJson = JSON.stringify(perspective, null, 2);

  const errors: RunError[] = [];
  const settled = await allSettledWithConcurrency(
    chunksToAnalyze,
    MAX_CONCURRENT_CHUNK_EXTRACTIONS,
    async (chunk) => analyzeChunk(chunk, parsedSourceMap.get(chunk.sourceId)!, perspectiveJson)
  );

  const extractedItems: EvidenceItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      extractedItems.push(...result.value);
      continue;
    }

    errors.push({
      step: "analyze_evidence",
      message: (result.reason as Error)?.message ?? "Chunk extraction failed",
      retryable: true,
      timestamp: new Date().toISOString(),
    });
  }

  if (extractedItems.length === 0) {
    memoryStore.updateProgress(runId, "analyze_evidence", {
      status: "failed",
      detail: "Every chunk extraction failed",
    });

    return {
      status: "failed",
      currentStep: "analyze_evidence",
      errors: [
        {
          step: "analyze_evidence",
          message: "No evidence could be extracted from the parsed chunks",
          retryable: true,
          timestamp: new Date().toISOString(),
        },
        ...errors,
      ],
    };
  }

  const reducedBySource = new Map<string, EvidenceItem[]>();
  for (const chunk of chunksToAnalyze) {
    const itemsForSource = extractedItems.filter((item) => item.sourceId === chunk.sourceId);
    if (itemsForSource.length === 0) continue;
    reducedBySource.set(chunk.sourceId, dedupeEvidence(itemsForSource));
  }

  const reducedItems = Array.from(reducedBySource.values()).flat();
  const evidenceMap: EvidenceMap = {
    supportingEvidence: reducedItems.filter((item) => item.evidenceType === "supporting"),
    contradictoryEvidence: reducedItems.filter(
      (item) => item.evidenceType === "contradictory"
    ),
    strongClaims: reducedItems.filter((item) => item.confidence === "high"),
    uncertainties: reducedItems.filter(
      (item) => item.confidence === "low" || item.evidenceType === "neutral"
    ),
    methodologicalCautions: reducedItems.filter(
      (item) => item.evidenceType === "methodological"
    ),
    personaFindings: Object.fromEntries(reducedBySource),
  };

  memoryStore.updateProgress(runId, "analyze_evidence", {
    status: "completed",
    detail: `${reducedItems.length} reduced evidence items extracted from ${chunksToAnalyze.length} chunks`,
  });

  return {
    evidenceMap,
    currentStep: "analyze_evidence",
    errors,
  };
}

async function analyzeChunk(
  chunk: SourceChunk,
  parsedSource: ParsedSource,
  perspectiveJson: string
): Promise<EvidenceItem[]> {
  const chunkText = await blobStore.getText(chunk.blobKey);

  const { data } = await callLLMJson<{ items: EvidenceItem[] }>({
    model: MODEL_LITE,
    messages: [
      {
        role: "system",
        content: buildChunkExtractionPrompt(parsedSource.name, chunk.headingPath, perspectiveJson),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            sourceName: parsedSource.name,
            sourceId: parsedSource.sourceId,
            headingPath: chunk.headingPath,
            chunkIndex: chunk.chunkIndex,
            chunkText,
          },
          null,
          2
        ),
      },
    ],
    temperature: 0.2,
    maxTokens: 2048,
    jsonSchema: CHUNK_EVIDENCE_SCHEMA,
  });

  return normalizeEvidenceItems(data.items ?? [], chunk, parsedSource);
}

function normalizeEvidenceItems(
  items: EvidenceItem[],
  chunk: SourceChunk,
  parsedSource: ParsedSource
): EvidenceItem[] {
  return items.map((item) => ({
    claim: item.claim.trim(),
    sourceId: parsedSource.sourceId,
    sourceName: parsedSource.name,
    location: item.location?.trim() || chunk.headingPath || `Chunk ${chunk.chunkIndex + 1}`,
    confidence: item.confidence ?? "medium",
    evidenceType: item.evidenceType ?? "neutral",
    quote: item.quote?.trim() || undefined,
  }));
}

function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  const reduced: EvidenceItem[] = [];

  for (const item of items) {
    const key = [
      item.sourceId,
      item.evidenceType,
      item.claim.trim().toLowerCase(),
      (item.quote ?? "").trim().toLowerCase(),
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    reduced.push(item);
  }

  return reduced;
}

function buildChunkExtractionPrompt(
  sourceName: string,
  headingPath: string,
  perspectiveSummary: string
) {
  return `You extract atomic evidence items from a single research-document chunk.

Return only evidence grounded in the provided chunk. Do not invent or generalize beyond the text.

Classify each item as one of:
- supporting — evidence that supports a hypothesis, claim, or trend relevant to the research question
- contradictory — evidence that undermines, qualifies, or opposes a claim
- methodological — observations about research methods, sample sizes, study design, or data quality
- neutral — factual context, definitions, or background that informs but doesn't directly argue for/against

EXTRACTION GUIDELINES:
- Extract 3-8 items per chunk. Err on the side of capturing MORE distinct claims rather than fewer.
- Each item should represent a DISTINCT atomic claim — do not merge separate findings into one.
- A single paragraph may contain multiple extractable claims (e.g., a result AND its effect size AND a caveat).
- Quantitative data (numbers, percentages, p-values, effect sizes) should always be extracted as separate items.
- Preserve the exact language from the chunk for quotes whenever possible.
- Do not skip evidence just because it seems minor — downstream consolidation will handle ranking.

Research perspective:
${perspectiveSummary}

Current source: ${sourceName}
Current section: ${headingPath}`;
}
