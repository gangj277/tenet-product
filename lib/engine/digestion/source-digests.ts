import type {
  EvidenceItem,
  EvidenceMap,
  ParsedSource,
  SourceChunk,
  SourceDigest,
  SourceDigestClaim,
} from "../state";

export const DIRECT_SOURCE_DIGEST_MAX_TOKENS = 9_000;
export const SOURCE_WINDOW_MAX_TOKENS = 6_000;
export const MAX_CLAIMS_PER_SOURCE = 8;
export const MAX_METHOD_NOTES_PER_SOURCE = 4;

export interface SourceWindow {
  sourceId: string;
  sourceName: string;
  windowIndex: number;
  headingPath: string;
  chunkIndexes: number[];
  tokenEstimate: number;
  text: string;
}

export function shouldDigestWholeSource(parsedSource: ParsedSource): boolean {
  return parsedSource.estimatedTokens <= DIRECT_SOURCE_DIGEST_MAX_TOKENS;
}

export function buildSourceWindows(params: {
  parsedSource: ParsedSource;
  sourceChunks: SourceChunk[];
  chunkTexts: Map<string, string>;
}): SourceWindow[] {
  const { parsedSource, sourceChunks, chunkTexts } = params;
  const ordered = [...sourceChunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const windows: SourceWindow[] = [];
  let currentChunks: SourceChunk[] = [];
  let currentParts: string[] = [];
  let currentTokens = 0;

  function flushWindow() {
    if (currentChunks.length === 0) return;
    const windowIndex = windows.length;
    const firstChunk = currentChunks[0]!;
    windows.push({
      sourceId: parsedSource.sourceId,
      sourceName: parsedSource.name,
      windowIndex,
      headingPath: firstChunk.headingPath,
      chunkIndexes: currentChunks.map((chunk) => chunk.chunkIndex),
      tokenEstimate: currentTokens,
      text: currentParts.join("\n\n").trim(),
    });
    currentChunks = [];
    currentParts = [];
    currentTokens = 0;
  }

  for (const chunk of ordered) {
    const chunkText = chunkTexts.get(chunk.blobKey);
    if (!chunkText) continue;
    const chunkBlock = [
      `## ${chunk.headingPath || `Chunk ${chunk.chunkIndex + 1}`}`,
      chunkText.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (
      currentChunks.length > 0 &&
      currentTokens + chunk.tokenEstimate > SOURCE_WINDOW_MAX_TOKENS
    ) {
      flushWindow();
    }

    currentChunks.push(chunk);
    currentParts.push(chunkBlock);
    currentTokens += chunk.tokenEstimate;
  }

  flushWindow();

  return windows;
}

export function normalizeSourceDigest(
  digest: {
    sourceSummary: string;
    openQuestions?: string[];
    claims?: Array<
      Partial<SourceDigestClaim> & {
        claim: string;
        confidence: "high" | "medium" | "low";
      }
    >;
    methodologicalNotes?: Array<{
      note: string;
      confidence: "high" | "medium" | "low";
      citations?: Array<{ location?: string; quote?: string }>;
    }>;
  },
  parsedSource: ParsedSource
): SourceDigest {
  const claims = (digest.claims ?? [])
    .map((claim) => normalizeDigestClaim(claim, parsedSource))
    .filter((claim): claim is SourceDigestClaim => claim !== null)
    .slice(0, MAX_CLAIMS_PER_SOURCE);

  const methodologicalNotes = (digest.methodologicalNotes ?? [])
    .map((note) => ({
      note: note.note.trim(),
      confidence: note.confidence,
      citations: normalizeCitations(note.citations),
    }))
    .filter((note) => note.note.length > 0)
    .slice(0, MAX_METHOD_NOTES_PER_SOURCE);

  return {
    sourceId: parsedSource.sourceId,
    sourceName: parsedSource.name,
    sourceSummary: digest.sourceSummary.trim(),
    claims,
    methodologicalNotes,
    openQuestions: (digest.openQuestions ?? [])
      .map((question) => question.trim())
      .filter(Boolean),
  };
}

function normalizeDigestClaim(
  claim: Partial<SourceDigestClaim> & {
    claim: string;
    confidence: "high" | "medium" | "low";
  },
  parsedSource: ParsedSource
): SourceDigestClaim | null {
  const rawClaim = claim.claim.trim();
  if (!rawClaim) return null;

  return {
    claimSignature: normalizeClaimSignature(claim.claimSignature || rawClaim),
    claim: rawClaim,
    subquestion: claim.subquestion?.trim() || undefined,
    stance: claim.stance ?? "neutral",
    confidence: claim.confidence,
    citations: normalizeCitations(claim.citations),
    caveats: (claim.caveats ?? []).map((value) => value.trim()).filter(Boolean),
  };
}

function normalizeCitations(
  citations?: Array<{ location?: string; quote?: string }>
): Array<{ location: string; quote?: string }> {
  const normalized = (citations ?? [])
    .map((citation) => ({
      location: citation.location?.trim() || "Source",
      quote: citation.quote?.trim() || undefined,
    }))
    .filter((citation) => citation.location.length > 0);

  return normalized.length > 0 ? normalized : [{ location: "Source" }];
}

export function normalizeClaimSignature(signature: string): string {
  return signature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "claim";
}

export function buildEvidenceMapFromSourceDigests(
  sourceDigests: SourceDigest[]
): EvidenceMap {
  const supportingEvidence: EvidenceItem[] = [];
  const contradictoryEvidence: EvidenceItem[] = [];
  const strongClaims: EvidenceItem[] = [];
  const uncertainties: EvidenceItem[] = [];
  const methodologicalCautions: EvidenceItem[] = [];
  const personaFindings: Record<string, EvidenceItem[]> = {};

  for (const digest of sourceDigests) {
    const perSource: EvidenceItem[] = [];

    for (const claim of digest.claims) {
      const citation = claim.citations[0];
      const evidenceType =
        claim.stance === "supporting"
          ? "supporting"
          : claim.stance === "contradictory"
            ? "contradictory"
            : "neutral";
      const item: EvidenceItem = {
        claim: claim.claim,
        sourceId: digest.sourceId,
        sourceName: digest.sourceName,
        location: citation?.location ?? "Source",
        confidence: claim.confidence,
        evidenceType,
        quote: citation?.quote,
      };

      perSource.push(item);
      if (evidenceType === "supporting") supportingEvidence.push(item);
      if (evidenceType === "contradictory") contradictoryEvidence.push(item);
      if (claim.confidence === "high") strongClaims.push(item);
      if (claim.confidence === "low" || evidenceType === "neutral") {
        uncertainties.push(item);
      }
    }

    for (const note of digest.methodologicalNotes) {
      const citation = note.citations[0];
      const item: EvidenceItem = {
        claim: note.note,
        sourceId: digest.sourceId,
        sourceName: digest.sourceName,
        location: citation?.location ?? "Source",
        confidence: note.confidence,
        evidenceType: "methodological",
        quote: citation?.quote,
      };

      perSource.push(item);
      methodologicalCautions.push(item);
    }

    personaFindings[digest.sourceId] = perSource;
  }

  return {
    supportingEvidence,
    contradictoryEvidence,
    strongClaims,
    uncertainties,
    methodologicalCautions,
    personaFindings,
  };
}
