import {
  searchOpenAlexWorks,
  type OpenAlexWork,
} from "@/lib/discovery/openalex";
import {
  buildPaperQualityMeta,
  type PaperQualityMeta,
} from "@/lib/discovery/paper-quality";
import {
  searchSemanticScholarPapers,
  type SemanticScholarPaper,
} from "@/lib/discovery/semantic-scholar";
import { searchArxivPapers, type ArxivPaper } from "@/lib/discovery/arxiv";
import {
  type SearchFilterConfig,
  toSemanticScholarPublicationTypes,
  toSemanticScholarDateRange,
  toOpenAlexType,
} from "@/lib/discovery/search-filters";

export type ScholarlyProvider = "openalex" | "semantic-scholar" | "arxiv";

export interface ScholarlyDiscoveredSource {
  title: string;
  url: string;
  pdfUrl?: string;
  publishedDate?: string;
  author?: string;
  provider: ScholarlyProvider;
  providers: ScholarlyProvider[];
  doi?: string;
  arxivId?: string;
  citationCount?: number;
  venue?: string;
  paperQuality?: PaperQualityMeta;
}

export type DiscoveredSource = ScholarlyDiscoveredSource;

interface NormalizedCandidate extends ScholarlyDiscoveredSource {
  dedupeKey: string;
  openAlexId?: string;
  semanticScholarPaperId?: string;
  publicationYear?: number;
  influentialCitationCount?: number;
  referenceCount?: number;
  openAccess?: boolean;
  preprint?: boolean;
  /** Index of the search query that produced this candidate (for balanced selection). */
  queryIndex: number;
}

interface ScholarlySearchClients {
  searchOpenAlexWorks?: typeof searchOpenAlexWorks;
  searchSemanticScholarPapers?: typeof searchSemanticScholarPapers;
  searchArxivPapers?: typeof searchArxivPapers;
}

export async function discoverScholarlySources({
  query,
  numResults = 15,
  queryVariations = [],
  filters,
  openAlexApiKey = process.env.OPENALEX_API_KEY,
  semanticScholarApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY,
  clients = {},
}: {
  query: string;
  numResults?: number;
  queryVariations?: string[];
  /** Optional search filters (venues, citation threshold, dates, etc.) */
  filters?: SearchFilterConfig;
  openAlexApiKey?: string;
  semanticScholarApiKey?: string;
  clients?: ScholarlySearchClients;
}): Promise<ScholarlyDiscoveredSource[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("query is required");
  }

  const searchQueries = uniqueQueries([trimmedQuery, ...queryVariations]).slice(0, 6);
  // Overfetch per query — dedup will collapse duplicates across queries and providers,
  // so we need a much larger raw pool than the final numResults target.
  const perQueryResults = 8;

  const openAlexSearch = clients.searchOpenAlexWorks ?? searchOpenAlexWorks;
  const semanticScholarSearch =
    clients.searchSemanticScholarPapers ?? searchSemanticScholarPapers;
  const arxivSearch = clients.searchArxivPapers ?? searchArxivPapers;

  const tasks: Array<Promise<NormalizedCandidate[]>> = [];

  if (openAlexApiKey?.trim()) {
    for (let qi = 0; qi < searchQueries.length; qi++) {
      const qIdx = qi;
      tasks.push(
        openAlexSearch({
          query: searchQueries[qIdx],
          apiKey: openAlexApiKey.trim(),
          perPage: perQueryResults,
          venue: filters?.venues,
          minCitationCount: filters?.minCitationCount,
          fromPublicationDate: filters?.dateFrom,
          toPublicationDate: filters?.dateTo,
          publicationType: toOpenAlexType(filters?.publicationType),
          isOpenAccess: filters?.openAccessOnly,
        }).then((works) =>
          works.map(normalizeOpenAlexWork).filter(isCandidate).map((c) => ({ ...c, queryIndex: qIdx }))
        )
      );
    }
  }

  for (let qi = 0; qi < searchQueries.length; qi++) {
    const qIdx = qi;
    tasks.push(
      semanticScholarSearch({
        query: searchQueries[qIdx],
        apiKey: semanticScholarApiKey?.trim(),
        maxResults: perQueryResults,
        sort: "citationCount:desc",
        fallbackToPublicSearchOnForbidden: true,
        venue: filters?.venues,
        minCitationCount: filters?.minCitationCount,
        publicationTypes: toSemanticScholarPublicationTypes(filters?.publicationType),
        publicationDateOrYear: toSemanticScholarDateRange(filters?.dateFrom, filters?.dateTo),
        openAccessPdfOnly: filters?.openAccessOnly,
      }).then((result) =>
        result.papers.map(normalizeSemanticScholarPaper).filter(isCandidate).map((c) => ({ ...c, queryIndex: qIdx }))
      )
    );
  }

  // arXiv only supports date range natively.
  // If venue filter is set, skip arXiv entirely (it has no venue/journal concept).
  const skipArxiv = filters?.venues && filters.venues.length > 0;

  if (!skipArxiv) {
    const arxivDateRange =
      filters?.dateFrom || filters?.dateTo
        ? {
            from: (filters.dateFrom ?? "2000-01-01").replace(/-/g, ""),
            to: (filters.dateTo ?? new Date().toISOString().slice(0, 10)).replace(/-/g, ""),
          }
        : undefined;

    for (let qi = 0; qi < searchQueries.length; qi++) {
      const qIdx = qi;
      tasks.push(
        arxivSearch({
          query: searchQueries[qIdx],
          maxResults: perQueryResults,
          sortBy: "relevance",
          sortOrder: "descending",
          submittedDateRange: arxivDateRange,
        }).then((result) =>
          result.papers.map(normalizeArxivPaper).filter(isCandidate).map((c) => ({ ...c, queryIndex: qIdx }))
        )
      );
    }
  }

  const settled = await Promise.allSettled(tasks);
  const candidates = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  return mergeAndRankCandidates(candidates, numResults, searchQueries.length)
    .map(stripInternalFields);
}

function normalizeOpenAlexWork(work: OpenAlexWork): NormalizedCandidate | null {
  const doi = normalizeDoi(work.doi);
  const landingPageUrl = normalizeUrl(work.landingPageUrl);
  const pdfUrl = normalizeUrl(work.pdfUrl);
  const sourceUrl = landingPageUrl ?? (doi ? buildDoiUrl(doi) : undefined);

  if (!sourceUrl && !pdfUrl) {
    return null;
  }

  return {
    title: work.title,
    url: sourceUrl ?? pdfUrl ?? "",
    pdfUrl,
    publishedDate: work.publicationDate,
    author: undefined,
    provider: "openalex",
    providers: ["openalex"],
    doi,
    arxivId: undefined,
    citationCount: work.citedByCount,
    venue: work.source,
    openAlexId: work.id,
    publicationYear: work.publicationYear,
    influentialCitationCount: undefined,
    referenceCount: undefined,
    openAccess: Boolean(pdfUrl),
    preprint: false,
    queryIndex: 0,
    dedupeKey: buildDedupeKey({
      doi,
      url: sourceUrl,
      title: work.title,
      publishedDate: work.publicationDate,
    }),
  };
}

function normalizeSemanticScholarPaper(
  paper: SemanticScholarPaper
): NormalizedCandidate | null {
  const doi = normalizeDoi(paper.externalIds.DOI);
  const arxivId =
    normalizeArxivId(paper.externalIds.ArXiv) ??
    (paper.sourceUrlKind === "arxiv" ? extractArxivIdFromUrl(paper.sourceUrl) : undefined);
  const pdfUrl = normalizeUrl(paper.pdfUrl);
  const sourceUrl = normalizeUrl(paper.landingPageUrl || paper.sourceUrl);

  if (paper.sourceUrlKind === "semantic_scholar" && !pdfUrl) {
    return null;
  }

  if (!sourceUrl && !pdfUrl) {
    return null;
  }

  return {
    title: paper.title,
    url: sourceUrl ?? pdfUrl ?? "",
    pdfUrl,
    publishedDate: paper.publicationDate,
    author: undefined,
    provider: "semantic-scholar",
    providers: ["semantic-scholar"],
    doi,
    arxivId,
    citationCount: paper.citationCount,
    venue: paper.venue,
    semanticScholarPaperId: paper.paperId,
    publicationYear: paper.year,
    influentialCitationCount: normalizePositiveNumber(paper.influentialCitationCount),
    referenceCount: normalizePositiveNumber(paper.referenceCount),
    openAccess: Boolean(pdfUrl),
    preprint: paper.sourceUrlKind === "arxiv",
    queryIndex: 0,
    dedupeKey: buildDedupeKey({
      doi,
      arxivId,
      url: sourceUrl,
      title: paper.title,
      publishedDate: paper.publicationDate,
    }),
  };
}

function normalizeArxivPaper(paper: ArxivPaper): NormalizedCandidate | null {
  const sourceUrl = normalizeUrl(paper.sourceUrl);
  const pdfUrl = normalizeUrl(paper.pdfUrl);

  if (!sourceUrl && !pdfUrl) {
    return null;
  }

  return {
    title: paper.title,
    url: sourceUrl ?? pdfUrl ?? "",
    pdfUrl,
    publishedDate: normalizeDatePrefix(paper.published),
    author: paper.authors[0],
    provider: "arxiv",
    providers: ["arxiv"],
    doi: undefined,
    arxivId: normalizeArxivId(paper.arxivId),
    citationCount: undefined,
    venue: undefined,
    openAlexId: undefined,
    semanticScholarPaperId: undefined,
    publicationYear: normalizePublicationYear(paper.published),
    influentialCitationCount: undefined,
    referenceCount: undefined,
    openAccess: Boolean(pdfUrl),
    preprint: true,
    queryIndex: 0,
    dedupeKey: buildDedupeKey({
      arxivId: paper.arxivId,
      url: sourceUrl,
      title: paper.title,
      publishedDate: paper.published,
    }),
  };
}

/**
 * Merge duplicates across providers/queries, then select results using
 * **balanced round-robin** so every query gets fair representation.
 *
 * Strategy:
 * 1. Deduplicate by dedupeKey (DOI / arXiv ID / URL / title+year).
 *    When a paper appears from multiple queries, it belongs to the
 *    *lowest* queryIndex (the most "primary" query that found it).
 * 2. Group deduplicated candidates by queryIndex, sort each group by quality.
 * 3. Round-robin: take the best remaining paper from each query in turn
 *    until we hit numResults. This guarantees every query contributes at
 *    least floor(numResults / numQueries) papers (if it has that many).
 * 4. If a query's bucket is exhausted, skip it and continue round-robin
 *    with the remaining queries.
 */
function mergeAndRankCandidates(
  candidates: NormalizedCandidate[],
  numResults: number,
  numQueries: number
) {
  // --- Phase 1: Deduplicate, keeping the lowest queryIndex as "owner" ---
  const merged = new Map<string, NormalizedCandidate>();
  /** Track ALL query indices that found each paper (for multi-query bonus). */
  const queryIndicesMap = new Map<string, Set<number>>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.dedupeKey);

    if (!existing) {
      merged.set(candidate.dedupeKey, {
        ...candidate,
        providers: [...candidate.providers],
      });
      queryIndicesMap.set(candidate.dedupeKey, new Set([candidate.queryIndex]));
      continue;
    }

    // Track that this query also found the paper
    queryIndicesMap.get(candidate.dedupeKey)!.add(candidate.queryIndex);

    // Keep the lowest queryIndex as the canonical owner
    if (candidate.queryIndex < existing.queryIndex) {
      existing.queryIndex = candidate.queryIndex;
    }

    // Merge metadata as before
    existing.pdfUrl = existing.pdfUrl ?? candidate.pdfUrl;
    existing.url = existing.url || candidate.url;
    existing.publishedDate = existing.publishedDate ?? candidate.publishedDate;
    existing.author = existing.author ?? candidate.author;
    existing.doi = existing.doi ?? candidate.doi;
    existing.arxivId = existing.arxivId ?? candidate.arxivId;
    existing.citationCount = mergeMaxNumber(
      existing.citationCount,
      candidate.citationCount
    );
    existing.venue = existing.venue ?? candidate.venue;
    existing.openAlexId = existing.openAlexId ?? candidate.openAlexId;
    existing.semanticScholarPaperId =
      existing.semanticScholarPaperId ?? candidate.semanticScholarPaperId;
    existing.publicationYear = existing.publicationYear ?? candidate.publicationYear;
    existing.influentialCitationCount = mergeMaxNumber(
      existing.influentialCitationCount,
      candidate.influentialCitationCount
    );
    existing.referenceCount = mergeMaxNumber(
      existing.referenceCount,
      candidate.referenceCount
    );
    existing.openAccess = Boolean(existing.openAccess || candidate.openAccess);
    existing.preprint = Boolean(existing.preprint || candidate.preprint);

    if (!existing.providers.includes(candidate.provider)) {
      existing.providers.push(candidate.provider);
    }
  }

  // --- Phase 2: Group by queryIndex, sort each group by quality ---
  const buckets = new Map<number, NormalizedCandidate[]>();
  for (let i = 0; i < numQueries; i++) {
    buckets.set(i, []);
  }

  for (const paper of merged.values()) {
    const bucket = buckets.get(paper.queryIndex);
    if (bucket) {
      bucket.push(paper);
    } else {
      // Safety: if queryIndex is somehow out of range, put in bucket 0
      buckets.get(0)!.push(paper);
    }
  }

  for (const bucket of buckets.values()) {
    bucket.sort(compareCandidates);
  }

  // --- Phase 3: Round-robin selection ---
  const selected: NormalizedCandidate[] = [];
  const selectedKeys = new Set<string>();
  const bucketPointers = new Map<number, number>();
  for (let i = 0; i < numQueries; i++) {
    bucketPointers.set(i, 0);
  }

  // Keep cycling through queries until we have enough or all buckets are exhausted
  let activeQueries = numQueries;
  while (selected.length < numResults && activeQueries > 0) {
    activeQueries = 0;
    for (let qi = 0; qi < numQueries; qi++) {
      if (selected.length >= numResults) break;

      const bucket = buckets.get(qi)!;
      let ptr = bucketPointers.get(qi)!;

      // Skip already-selected papers (can happen if a paper was assigned to
      // a lower queryIndex but also exists in this bucket from dedup)
      while (ptr < bucket.length && selectedKeys.has(bucket[ptr].dedupeKey)) {
        ptr++;
      }

      if (ptr < bucket.length) {
        selected.push(bucket[ptr]);
        selectedKeys.add(bucket[ptr].dedupeKey);
        bucketPointers.set(qi, ptr + 1);
        activeQueries++;
      }
    }
  }

  return selected;
}

function compareCandidates(
  left: ScholarlyDiscoveredSource,
  right: ScholarlyDiscoveredSource
) {
  if (Boolean(left.pdfUrl) !== Boolean(right.pdfUrl)) {
    return left.pdfUrl ? -1 : 1;
  }

  if (left.providers.length !== right.providers.length) {
    return right.providers.length - left.providers.length;
  }

  if ((left.citationCount ?? 0) !== (right.citationCount ?? 0)) {
    return (right.citationCount ?? 0) - (left.citationCount ?? 0);
  }

  const leftDate = left.publishedDate ?? "";
  const rightDate = right.publishedDate ?? "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }

  return left.title.localeCompare(right.title);
}

function buildDedupeKey({
  doi,
  arxivId,
  url,
  title,
  publishedDate,
}: {
  doi?: string;
  arxivId?: string;
  url?: string;
  title: string;
  publishedDate?: string;
}) {
  if (doi) {
    return `doi:${doi}`;
  }

  if (arxivId) {
    return `arxiv:${arxivId}`;
  }

  const normalizedUrl = normalizeUrlForKey(url);
  if (normalizedUrl) {
    return `url:${normalizedUrl}`;
  }

  const year = publishedDate?.slice(0, 4) ?? "";
  return `title:${normalizeTitle(title)}:${year}`;
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrlForKey(url?: string) {
  const normalized = normalizeUrl(url);
  return normalized?.replace(/\/+$/, "");
}

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDoi(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

function buildDoiUrl(doi: string) {
  return `https://doi.org/${doi}`;
}

function normalizeArxivId(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^arxiv:/i, "");
}

function extractArxivIdFromUrl(url?: string) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return undefined;
  }

  const match =
    normalized.match(/\/abs\/([^/?#]+)/i) ??
    normalized.match(/\/pdf\/([^/?#]+)/i);

  return match?.[1];
}

function normalizeDatePrefix(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 10) : undefined;
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(trimmed);
  }

  return results;
}

function isCandidate<T>(value: T | null): value is T {
  return value !== null;
}

function stripInternalFields({
  dedupeKey,
  openAlexId,
  semanticScholarPaperId,
  publicationYear,
  influentialCitationCount,
  referenceCount,
  openAccess,
  preprint,
  queryIndex,
  ...source
}: NormalizedCandidate): ScholarlyDiscoveredSource {
  void dedupeKey;
  void queryIndex;
  return {
    ...source,
    paperQuality: buildPaperQualityMeta({
      doi: source.doi,
      openAlexId,
      semanticScholarPaperId,
      arxivId: source.arxivId,
      year: publicationYear,
      date: source.publishedDate,
      venue: source.venue,
      citationCount: source.citationCount,
      influentialCitationCount,
      referenceCount,
      providerCount: source.providers.length,
      openAccess,
      preprint,
    }),
  };
}

function normalizePublicationYear(value?: string) {
  const year = Number.parseInt(value?.slice(0, 4) ?? "", 10);
  return Number.isFinite(year) ? year : undefined;
}

function normalizePositiveNumber(value?: number) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function mergeMaxNumber(left?: number, right?: number) {
  if (typeof left === "number" && typeof right === "number") {
    return Math.max(left, right);
  }

  return typeof left === "number" ? left : right;
}
