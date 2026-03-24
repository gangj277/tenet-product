import type {
  EvidenceItem,
  EvidenceMap,
  Perspective,
} from "../state";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "does",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

const MAX_SUPPORT_ITEMS = 4;
const MAX_CONTRADICTION_ITEMS = 4;
const MAX_CAUTION_ITEMS = 3;
const MAX_UNCERTAINTY_ITEMS = 3;

export interface ReducedEvidenceItem extends EvidenceItem {
  evidenceId: string;
  claimKey: string;
  claimTokens: string[];
}

export interface EvidenceCluster {
  clusterId: string;
  representativeClaim: string;
  claimKey: string;
  keyTerms: string[];
  assignedSubquestion?: string;
  sourceDiversity: number;
  totalEvidence: number;
  supportingEvidence: ReducedEvidenceItem[];
  contradictoryEvidence: ReducedEvidenceItem[];
  methodologicalCautions: ReducedEvidenceItem[];
  uncertainties: ReducedEvidenceItem[];
}

export interface CompactEvidenceCluster {
  clusterId: string;
  representativeClaim: string;
  assignedSubquestion?: string;
  keyTerms: string[];
  sourceDiversity: number;
  evidenceCounts: {
    supporting: number;
    contradictory: number;
    methodological: number;
    uncertainties: number;
  };
  supportingEvidence: EvidenceItem[];
  contradictoryEvidence: EvidenceItem[];
  methodologicalCautions: EvidenceItem[];
  uncertainties: EvidenceItem[];
}

interface WorkingEvidenceCluster {
  clusterId: string;
  representativeClaim: string;
  representativeTokens: string[];
  items: ReducedEvidenceItem[];
}

export function reduceAndClusterEvidence({
  perspective,
  evidenceMap,
}: {
  perspective?: Perspective;
  evidenceMap: EvidenceMap;
}): {
  uniqueEvidence: ReducedEvidenceItem[];
  duplicateCount: number;
  clusters: EvidenceCluster[];
} {
  const { uniqueEvidence, duplicateCount } = flattenAndDedupeEvidence(evidenceMap);
  const clusters = buildClusters(uniqueEvidence, perspective);
  return { uniqueEvidence, duplicateCount, clusters };
}

export function toCompactClusterPayload(
  cluster: EvidenceCluster
): CompactEvidenceCluster {
  return {
    clusterId: cluster.clusterId,
    representativeClaim: cluster.representativeClaim,
    assignedSubquestion: cluster.assignedSubquestion,
    keyTerms: cluster.keyTerms,
    sourceDiversity: cluster.sourceDiversity,
    evidenceCounts: {
      supporting: cluster.supportingEvidence.length,
      contradictory: cluster.contradictoryEvidence.length,
      methodological: cluster.methodologicalCautions.length,
      uncertainties: cluster.uncertainties.length,
    },
    supportingEvidence: pickTopEvidence(cluster.supportingEvidence, MAX_SUPPORT_ITEMS),
    contradictoryEvidence: pickTopEvidence(
      cluster.contradictoryEvidence,
      MAX_CONTRADICTION_ITEMS
    ),
    methodologicalCautions: pickTopEvidence(
      cluster.methodologicalCautions,
      MAX_CAUTION_ITEMS
    ),
    uncertainties: pickTopEvidence(cluster.uncertainties, MAX_UNCERTAINTY_ITEMS),
  };
}

function flattenAndDedupeEvidence(evidenceMap: EvidenceMap): {
  uniqueEvidence: ReducedEvidenceItem[];
  duplicateCount: number;
} {
  const orderedItems: EvidenceItem[] = [
    ...evidenceMap.supportingEvidence,
    ...evidenceMap.contradictoryEvidence,
    ...evidenceMap.strongClaims,
    ...evidenceMap.uncertainties,
    ...evidenceMap.methodologicalCautions,
  ];

  const seen = new Map<string, ReducedEvidenceItem>();
  let duplicateCount = 0;

  for (const item of orderedItems) {
    const claimTokens = tokenize(item.claim);
    const claimKey = claimTokens.join(" ");
    const fingerprint = [
      item.sourceId,
      item.sourceName.trim().toLowerCase(),
      item.location.trim().toLowerCase(),
      item.evidenceType,
      item.confidence,
      claimKey,
      normalizeFreeText(item.quote ?? ""),
    ].join("::");

    if (seen.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }

    seen.set(fingerprint, {
      ...item,
      evidenceId: fingerprint,
      claimKey,
      claimTokens,
    });
  }

  return {
    uniqueEvidence: Array.from(seen.values()),
    duplicateCount,
  };
}

function buildClusters(
  items: ReducedEvidenceItem[],
  perspective?: Perspective
): EvidenceCluster[] {
  const sorted = [...items].sort(compareEvidencePriority);
  const working: WorkingEvidenceCluster[] = [];

  for (const item of sorted) {
    const match = findBestClusterMatch(item, working);
    if (!match) {
      working.push({
        clusterId: `cluster-${working.length + 1}`,
        representativeClaim: item.claim,
        representativeTokens: item.claimTokens,
        items: [item],
      });
      continue;
    }

    match.items.push(item);
    if (compareEvidencePriority(item, match.items[0]!) < 0) {
      match.representativeClaim = item.claim;
      match.representativeTokens = item.claimTokens;
    }
  }

  return working
    .map((cluster) => materializeCluster(cluster, perspective))
    .sort(compareClusterPriority);
}

function materializeCluster(
  cluster: {
    clusterId: string;
    representativeClaim: string;
    representativeTokens: string[];
    items: ReducedEvidenceItem[];
  },
  perspective?: Perspective
): EvidenceCluster {
  const supportingEvidence = cluster.items.filter(
    (item) => item.evidenceType === "supporting"
  );
  const contradictoryEvidence = cluster.items.filter(
    (item) => item.evidenceType === "contradictory"
  );
  const methodologicalCautions = cluster.items.filter(
    (item) => item.evidenceType === "methodological"
  );
  const uncertainties = cluster.items.filter(
    (item) =>
      item.evidenceType === "neutral" || item.confidence === "low"
  );

  const sourceDiversity = new Set(cluster.items.map((item) => item.sourceId)).size;
  const keyTerms = topTerms(cluster.items.flatMap((item) => item.claimTokens));
  const claimKey = cluster.representativeTokens.join(" ");

  return {
    clusterId: cluster.clusterId,
    representativeClaim: cluster.representativeClaim,
    claimKey,
    keyTerms,
    assignedSubquestion: assignSubquestion(cluster.representativeTokens, perspective),
    sourceDiversity,
    totalEvidence: cluster.items.length,
    supportingEvidence,
    contradictoryEvidence,
    methodologicalCautions,
    uncertainties,
  };
}

function findBestClusterMatch(
  item: ReducedEvidenceItem,
  clusters: WorkingEvidenceCluster[]
) {
  let best: WorkingEvidenceCluster | undefined;
  let bestScore = 0;

  for (const cluster of clusters) {
    const similarity = claimSimilarity(item.claimTokens, cluster.representativeTokens);
    if (similarity > bestScore) {
      best = cluster;
      bestScore = similarity;
    }
  }

  return bestScore >= 0.3 ? best : undefined;
}

function compareClusterPriority(a: EvidenceCluster, b: EvidenceCluster) {
  const aScore =
    a.sourceDiversity * 4 +
    a.totalEvidence +
    a.contradictoryEvidence.length * 0.5 +
    a.methodologicalCautions.length * 0.25;
  const bScore =
    b.sourceDiversity * 4 +
    b.totalEvidence +
    b.contradictoryEvidence.length * 0.5 +
    b.methodologicalCautions.length * 0.25;

  if (bScore !== aScore) return bScore - aScore;
  return a.representativeClaim.localeCompare(b.representativeClaim);
}

function compareEvidencePriority(a: EvidenceItem, b: EvidenceItem) {
  const priorityDiff = evidencePriorityScore(b) - evidencePriorityScore(a);
  if (priorityDiff !== 0) return priorityDiff;
  return a.claim.localeCompare(b.claim);
}

function evidencePriorityScore(item: EvidenceItem) {
  const confidenceWeight =
    item.confidence === "high" ? 3 : item.confidence === "medium" ? 2 : 1;
  const evidenceTypeWeight =
    item.evidenceType === "supporting"
      ? 3
      : item.evidenceType === "contradictory"
        ? 2
        : item.evidenceType === "methodological"
          ? 1
          : 0;
  const quoteWeight = item.quote?.trim() ? 1 : 0;
  return confidenceWeight * 10 + evidenceTypeWeight * 3 + quoteWeight;
}

function claimSimilarity(aTokens: string[], bTokens: string[]) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  if (aTokens.join(" ") === bTokens.join(" ")) return 1;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;

  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }

  const union = new Set([...aSet, ...bSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  const containment = intersection / Math.min(aSet.size, bSet.size);

  if (intersection >= 4 && containment >= 0.5) return Math.max(jaccard, containment);
  if (intersection >= 3) return Math.max(jaccard, containment * 0.9);
  return jaccard;
}

function tokenize(text: string): string[] {
  return normalizeFreeText(text)
    .split(" ")
    .map(stemToken)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function normalizeFreeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(token: string) {
  if (token.length <= 4) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing")) return token.slice(0, -3);
  if (token.endsWith("ed")) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function topTerms(tokens: string[]): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 6)
    .map(([token]) => token);
}

function assignSubquestion(
  claimTokens: string[],
  perspective?: Perspective
): string | undefined {
  if (!perspective?.subquestions?.length) return undefined;

  let bestQuestion: string | undefined;
  let bestScore = 0;

  for (const question of perspective.subquestions) {
    const score = claimSimilarity(claimTokens, tokenize(question));
    if (score > bestScore) {
      bestQuestion = question;
      bestScore = score;
    }
  }

  return bestScore >= 0.2 ? bestQuestion : undefined;
}

function pickTopEvidence(
  items: ReducedEvidenceItem[],
  limit: number
): EvidenceItem[] {
  const sorted = [...items].sort(compareEvidencePriority);
  const selected: ReducedEvidenceItem[] = [];
  const usedSources = new Set<string>();

  for (const phase of [0, 1]) {
    for (const item of sorted) {
      if (selected.includes(item)) continue;
      if (phase === 0 && usedSources.has(item.sourceId)) continue;

      selected.push(item);
      usedSources.add(item.sourceId);
      if (selected.length >= limit) {
        return selected.map(stripReducedFields);
      }
    }
  }

  return selected.map(stripReducedFields);
}

function stripReducedFields(item: ReducedEvidenceItem): EvidenceItem {
  const rest = { ...item };
  delete (rest as Partial<ReducedEvidenceItem>).evidenceId;
  delete (rest as Partial<ReducedEvidenceItem>).claimKey;
  delete (rest as Partial<ReducedEvidenceItem>).claimTokens;
  return rest;
}
