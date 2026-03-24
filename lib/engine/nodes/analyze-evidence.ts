import type {
  EvidenceItem,
  EvidenceMap,
  InitRunState,
  InitRunUpdate,
  ParsedSource,
  RunError,
  SourceChunk,
  SourceDigest,
} from "../state";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL_LITE } from "@/lib/llm/models";
import { memoryStore } from "@/lib/storage/memory-store";
import { blobStore } from "@/lib/storage/blob-store";
import { allSettledWithConcurrency } from "@/lib/utils/async";
import {
  buildEvidenceMapFromSourceDigests,
  buildSourceWindows,
  normalizeSourceDigest,
  shouldDigestWholeSource,
} from "../digestion/source-digests";
import {
  buildSourceDigestMergePrompt,
  buildSourceDigestPrompt,
  buildSourceWindowNotesPrompt,
} from "../prompts/source-digestion";

const MAX_CONCURRENT_SOURCE_DIGESTS = 12;
const MAX_CONCURRENT_SOURCE_WINDOWS = 8;

const CITATION_SCHEMA = {
  type: "object",
  properties: {
    location: { type: "string" },
    quote: { type: "string" },
  },
  required: ["location", "quote"],
  additionalProperties: false,
} as const;

const DIGEST_CLAIM_SCHEMA = {
  type: "object",
  properties: {
    claimSignature: { type: "string" },
    claim: { type: "string" },
    subquestion: { type: "string" },
    stance: {
      type: "string",
      enum: ["supporting", "contradictory", "neutral"],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    citations: {
      type: "array",
      items: CITATION_SCHEMA,
    },
    caveats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "claimSignature",
    "claim",
    "subquestion",
    "confidence",
    "stance",
    "citations",
    "caveats",
  ],
  additionalProperties: false,
} as const;

const DIGEST_METHOD_NOTE_SCHEMA = {
  type: "object",
  properties: {
    note: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    citations: {
      type: "array",
      items: CITATION_SCHEMA,
    },
  },
  required: ["note", "confidence", "citations"],
  additionalProperties: false,
} as const;

const SOURCE_DIGEST_SCHEMA = {
  name: "source_digest",
  schema: {
    type: "object",
    properties: {
      sourceSummary: { type: "string" },
      claims: {
        type: "array",
        items: DIGEST_CLAIM_SCHEMA,
      },
      methodologicalNotes: {
        type: "array",
        items: DIGEST_METHOD_NOTE_SCHEMA,
      },
      openQuestions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["sourceSummary", "claims", "methodologicalNotes", "openQuestions"],
    additionalProperties: false,
  },
} as const;

const SOURCE_WINDOW_NOTES_SCHEMA = {
  ...SOURCE_DIGEST_SCHEMA,
  name: "source_window_notes",
} as const;

const SOURCE_DIGEST_MERGE_SCHEMA = {
  ...SOURCE_DIGEST_SCHEMA,
  name: "source_digest_merge",
} as const;

export async function analyzeEvidence(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, perspective, parsedSources, sourceChunks } = state;

  if (!perspective || !parsedSources?.length) {
    return {
      errors: [
        {
          step: "analyze_evidence",
          message: "Missing perspective or parsed sources",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const parsedSourceMap = new Map(parsedSources.map((source) => [source.sourceId, source]));
  const chunksToAnalyze = (sourceChunks ?? []).filter((chunk) =>
    parsedSourceMap.has(chunk.sourceId)
  );

  memoryStore.updateProgress(runId, "analyze_evidence", {
    status: "running",
    detail: `Digesting ${parsedSources.length} sources into source-level claims...`,
  });

  const perspectiveJson = JSON.stringify(perspective, null, 2);

  const errors: RunError[] = [];
  const chunksBySource = new Map<string, SourceChunk[]>();
  for (const chunk of chunksToAnalyze) {
    const bucket = chunksBySource.get(chunk.sourceId) ?? [];
    bucket.push(chunk);
    chunksBySource.set(chunk.sourceId, bucket);
  }

  const settled = await allSettledWithConcurrency(
    parsedSources,
    MAX_CONCURRENT_SOURCE_DIGESTS,
    async (parsedSource) =>
      digestSource(
        parsedSource,
        chunksBySource.get(parsedSource.sourceId) ?? [],
        perspectiveJson
      )
  );

  const sourceDigests: SourceDigest[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      sourceDigests.push(result.value);
      continue;
    }

    errors.push({
      step: "analyze_evidence",
      message: (result.reason as Error)?.message ?? "Source digestion failed",
      retryable: true,
      timestamp: new Date().toISOString(),
    });
  }

  if (sourceDigests.length === 0) {
    memoryStore.updateProgress(runId, "analyze_evidence", {
      status: "failed",
      detail: "Every source digestion failed",
    });

    return {
      status: "failed",
      currentStep: "analyze_evidence",
      errors: [
        {
          step: "analyze_evidence",
          message: "No source digests could be produced from the parsed sources",
          retryable: true,
          timestamp: new Date().toISOString(),
        },
        ...errors,
      ],
    };
  }

  const evidenceMap = buildEvidenceMapFromSourceDigests(sourceDigests);
  const reducedItems = Object.values(evidenceMap.personaFindings).flat();

  memoryStore.updateProgress(runId, "analyze_evidence", {
    status: "completed",
    detail: `${sourceDigests.length} source digests produced with ${reducedItems.length} reusable evidence items`,
  });

  return {
    sourceDigests,
    evidenceMap,
    currentStep: "analyze_evidence",
    errors,
  };
}

async function digestSource(
  parsedSource: ParsedSource,
  sourceChunks: SourceChunk[],
  perspectiveJson: string
): Promise<SourceDigest> {
  if (shouldDigestWholeSource(parsedSource) || sourceChunks.length === 0) {
    return digestWholeSource(parsedSource, perspectiveJson);
  }

  const chunkTexts = new Map(
    await Promise.all(
      sourceChunks.map(async (chunk) => [chunk.blobKey, await blobStore.getText(chunk.blobKey)] as const)
    )
  );
  const windows = buildSourceWindows({ parsedSource, sourceChunks, chunkTexts });
  if (windows.length === 0) {
    return fallbackToWholeSourceDigest(
      parsedSource,
      perspectiveJson,
      "All chunk windows were empty after loading chunk text."
    );
  }

  const notesSettled = await allSettledWithConcurrency(
    windows,
    MAX_CONCURRENT_SOURCE_WINDOWS,
    async (window) => {
      const { data } = await callLLMJson<Omit<SourceDigest, "sourceId" | "sourceName">>({
        model: MODEL_LITE,
        messages: [
          { role: "system", content: buildSourceWindowNotesPrompt() },
          {
            role: "user",
            content: JSON.stringify(
              {
                sourceId: parsedSource.sourceId,
                sourceName: parsedSource.name,
                perspective: JSON.parse(perspectiveJson) as unknown,
                windowIndex: window.windowIndex,
                headingPath: window.headingPath,
                chunkIndexes: window.chunkIndexes,
                windowText: window.text,
              },
              null,
              2
            ),
          },
        ],
        temperature: 0.1,
        maxTokens: 3072,
        jsonSchema: SOURCE_WINDOW_NOTES_SCHEMA,
      });

      return data;
    }
  );

  const windowNotes: Array<Omit<SourceDigest, "sourceId" | "sourceName">> = [];
  const windowErrors: string[] = [];
  for (const result of notesSettled) {
    if (result.status === "fulfilled") {
      windowNotes.push(result.value);
    } else {
      windowErrors.push(getErrorMessage(result.reason));
    }
  }

  if (windowNotes.length === 0) {
    return fallbackToWholeSourceDigest(
      parsedSource,
      perspectiveJson,
      `No source windows could be digested for ${parsedSource.name}. ${summarizeWindowErrors(windowErrors)}`
    );
  }

  const { data } = await callLLMJson<Omit<SourceDigest, "sourceId" | "sourceName">>({
    model: MODEL_LITE,
    messages: [
      { role: "system", content: buildSourceDigestMergePrompt() },
      {
        role: "user",
        content: JSON.stringify(
          {
            sourceId: parsedSource.sourceId,
            sourceName: parsedSource.name,
            perspective: JSON.parse(perspectiveJson) as unknown,
            windowNotes,
          },
          null,
          2
        ),
      },
    ],
    temperature: 0.1,
    maxTokens: 4096,
    jsonSchema: SOURCE_DIGEST_MERGE_SCHEMA,
  });

  return normalizeSourceDigest(data, parsedSource);
}

async function digestWholeSource(
  parsedSource: ParsedSource,
  perspectiveJson: string
): Promise<SourceDigest> {
  const sourceText = await blobStore.getText(parsedSource.normalizedBlobKey);
  const { data } = await callLLMJson<Omit<SourceDigest, "sourceId" | "sourceName">>({
    model: MODEL_LITE,
    messages: [
      { role: "system", content: buildSourceDigestPrompt() },
      {
        role: "user",
        content: JSON.stringify(
          {
            sourceId: parsedSource.sourceId,
            sourceName: parsedSource.name,
            perspective: JSON.parse(perspectiveJson) as unknown,
            sourceText,
          },
          null,
          2
        ),
      },
    ],
    temperature: 0.1,
    maxTokens: 4096,
    jsonSchema: SOURCE_DIGEST_SCHEMA,
  });

  return normalizeSourceDigest(data, parsedSource);
}

async function fallbackToWholeSourceDigest(
  parsedSource: ParsedSource,
  perspectiveJson: string,
  reason: string
): Promise<SourceDigest> {
  try {
    return await digestWholeSource(parsedSource, perspectiveJson);
  } catch (fallbackError) {
    throw new Error(
      `${reason} Fallback whole-source digest also failed: ${getErrorMessage(fallbackError)}`
    );
  }
}

function summarizeWindowErrors(errors: string[]): string {
  if (errors.length === 0) {
    return "No underlying window error details were captured.";
  }

  const unique = Array.from(new Set(errors.map((error) => error.trim()).filter(Boolean)));
  const preview = unique.slice(0, 3).join("; ");
  if (unique.length <= 3) {
    return `Window digest failures: ${preview}`;
  }
  return `Window digest failures: ${preview}; and ${unique.length - 3} more.`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
