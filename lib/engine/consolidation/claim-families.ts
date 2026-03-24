import type {
  ClaimFamily,
  ConsolidatedFindings,
  EvidenceItem,
  SourceDigest,
  SourceDigestClaim,
} from "../state";
import { normalizeClaimSignature } from "../digestion/source-digests";

const MAX_FAMILIES_PER_BATCH = 12;

export function buildClaimFamilies(sourceDigests: SourceDigest[]): ClaimFamily[] {
  const families = new Map<string, ClaimFamily>();

  for (const digest of sourceDigests) {
    for (const claim of digest.claims) {
      const familyKey = [
        claim.subquestion?.trim().toLowerCase() ?? "",
        normalizeClaimSignature(claim.claimSignature || claim.claim),
      ].join("::");
      const evidence = claimToEvidenceItem(digest, claim);

      let family = families.get(familyKey);
      if (!family) {
        family = {
          familyId: `family-${families.size + 1}`,
          claimSignature: normalizeClaimSignature(claim.claimSignature || claim.claim),
          representativeClaim: claim.claim,
          subquestion: claim.subquestion?.trim() || undefined,
          supportingEvidence: [],
          contradictoryEvidence: [],
          neutralEvidence: [],
          methodologicalNotes: [],
          caveats: [],
          sourceIds: [],
        };
        families.set(familyKey, family);
      }

      if (!family.sourceIds.includes(digest.sourceId)) {
        family.sourceIds.push(digest.sourceId);
      }

      if (
        compareEvidencePriority(evidence, claimToEvidenceItem(digest, {
          ...claim,
          claim: family.representativeClaim,
        })) > 0
      ) {
        family.representativeClaim = claim.claim;
      }

      if (claim.stance === "supporting") {
        family.supportingEvidence.push(evidence);
      } else if (claim.stance === "contradictory") {
        family.contradictoryEvidence.push(evidence);
      } else {
        family.neutralEvidence.push(evidence);
      }

      for (const caveat of claim.caveats) {
        if (!family.caveats.includes(caveat)) {
          family.caveats.push(caveat);
        }
      }

      for (const note of digest.methodologicalNotes) {
        if (!family.methodologicalNotes.includes(note.note)) {
          family.methodologicalNotes.push(note.note);
        }
      }
    }
  }

  return Array.from(families.values()).sort((left, right) => {
    const leftScore = left.sourceIds.length * 4 + left.supportingEvidence.length + left.contradictoryEvidence.length;
    const rightScore =
      right.sourceIds.length * 4 + right.supportingEvidence.length + right.contradictoryEvidence.length;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.representativeClaim.localeCompare(right.representativeClaim);
  });
}

function claimToEvidenceItem(digest: SourceDigest, claim: SourceDigestClaim): EvidenceItem {
  const citation = claim.citations[0];
  return {
    claim: claim.claim,
    sourceId: digest.sourceId,
    sourceName: digest.sourceName,
    location: citation?.location ?? "Source",
    confidence: claim.confidence,
    evidenceType:
      claim.stance === "supporting"
        ? "supporting"
        : claim.stance === "contradictory"
          ? "contradictory"
          : "neutral",
    quote: citation?.quote,
  };
}

function compareEvidencePriority(left: EvidenceItem, right: EvidenceItem): number {
  return evidencePriorityScore(left) - evidencePriorityScore(right);
}

function evidencePriorityScore(item: EvidenceItem): number {
  const confidenceWeight =
    item.confidence === "high" ? 3 : item.confidence === "medium" ? 2 : 1;
  const contradictionWeight = item.evidenceType === "contradictory" ? 1 : 0;
  const quoteWeight = item.quote ? 1 : 0;
  return confidenceWeight * 10 + contradictionWeight * 2 + quoteWeight;
}

export interface ClaimFamilyBatch {
  batchId: string;
  subquestion?: string;
  families: ClaimFamily[];
}

export function batchClaimFamilies(families: ClaimFamily[]): ClaimFamilyBatch[] {
  const grouped = new Map<string, ClaimFamily[]>();
  for (const family of families) {
    const key = family.subquestion ?? "__none__";
    const bucket = grouped.get(key) ?? [];
    bucket.push(family);
    grouped.set(key, bucket);
  }

  const batches: ClaimFamilyBatch[] = [];
  for (const [subquestion, groupedFamilies] of grouped.entries()) {
    for (let index = 0; index < groupedFamilies.length; index += MAX_FAMILIES_PER_BATCH) {
      batches.push({
        batchId: `batch-${batches.length + 1}`,
        subquestion: subquestion === "__none__" ? undefined : subquestion,
        families: groupedFamilies.slice(index, index + MAX_FAMILIES_PER_BATCH),
      });
    }
  }

  return batches;
}

export function mergeBatchFindings(
  findings: ConsolidatedFindings[]
): ConsolidatedFindings {
  return {
    canonicalClaims: findings.flatMap((finding) => finding.canonicalClaims),
    prioritizedSupport: dedupeEvidence(
      findings.flatMap((finding) => finding.prioritizedSupport)
    ).slice(0, 12),
    prioritizedContradictions: dedupeEvidence(
      findings.flatMap((finding) => finding.prioritizedContradictions)
    ).slice(0, 12),
    openQuestions: dedupeStrings(findings.flatMap((finding) => finding.openQuestions)),
    confidenceNotes: dedupeStrings(findings.flatMap((finding) => finding.confidenceNotes)),
    unresolvedDisagreements: dedupeStrings(
      findings.flatMap((finding) => finding.unresolvedDisagreements)
    ),
  };
}

function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  const deduped: EvidenceItem[] = [];
  for (const item of items) {
    const key = [
      item.sourceId,
      item.claim.toLowerCase(),
      item.location.toLowerCase(),
      (item.quote ?? "").toLowerCase(),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}
