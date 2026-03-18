/**
 * Test script: validates that search filters work correctly against all 3 providers.
 *
 * Usage:
 *   npx tsx scripts/test-search-filters.ts
 *
 * Requires SEMANTIC_SCHOLAR_API_KEY and OPENALEX_API_KEY in .env
 */

import { loadEnvConfig } from "@next/env";
import { searchSemanticScholarPapers } from "../lib/discovery/semantic-scholar";
import { searchOpenAlexWorks } from "../lib/discovery/openalex";
import { searchArxivPapers } from "../lib/discovery/arxiv";
import { discoverScholarlySources } from "../lib/discovery/scholarly-search";
import type { SearchFilterConfig } from "../lib/discovery/search-filters";

loadEnvConfig(process.cwd());

const QUERY = "attention mechanism transformer";

interface TestCase {
  name: string;
  filters: SearchFilterConfig;
  /** What to check on results */
  validate: (results: Array<{ title: string; venue?: string; citationCount?: number; publishedDate?: string; provider?: string; providers?: string[] }>) => string[];
}

const TEST_CASES: TestCase[] = [
  {
    name: "Venue filter: ACL",
    filters: { venues: ["ACL"] },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results returned — venue filter may be too restrictive or API doesn't support it");
      }
      // Check if results actually mention ACL in venue
      const withVenue = results.filter((r) => r.venue);
      const aclMatches = withVenue.filter(
        (r) => r.venue?.toLowerCase().includes("acl") ||
               r.venue?.toLowerCase().includes("association for computational linguistics")
      );
      if (withVenue.length > 0 && aclMatches.length === 0) {
        warnings.push(
          `None of ${withVenue.length} results with venue data matched "ACL". Venues found: ${[...new Set(withVenue.map((r) => r.venue))].join(", ")}`
        );
      }
      return warnings;
    },
  },
  {
    name: "Venue filter: Nature",
    filters: { venues: ["Nature"] },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results returned for Nature filter");
      }
      const withVenue = results.filter((r) => r.venue);
      const matches = withVenue.filter(
        (r) => r.venue?.toLowerCase().includes("nature")
      );
      if (withVenue.length > 0 && matches.length === 0) {
        warnings.push(
          `None of ${withVenue.length} results matched "Nature". Venues: ${[...new Set(withVenue.map((r) => r.venue))].join(", ")}`
        );
      }
      return warnings;
    },
  },
  {
    name: "Min citations: 100",
    filters: { minCitationCount: 100 },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results returned");
      }
      const belowThreshold = results.filter(
        (r) => r.citationCount !== undefined && r.citationCount < 100
      );
      if (belowThreshold.length > 0) {
        warnings.push(
          `${belowThreshold.length} results below 100 citations: ${belowThreshold.map((r) => `"${r.title.slice(0, 40)}..." (${r.citationCount})`).join(", ")}`
        );
      }
      return warnings;
    },
  },
  {
    name: "Date range: 2023-01-01 to 2024-12-31",
    filters: { dateFrom: "2023-01-01", dateTo: "2024-12-31" },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results returned");
      }
      const outOfRange = results.filter((r) => {
        if (!r.publishedDate) return false;
        return r.publishedDate < "2023-01-01" || r.publishedDate > "2024-12-31";
      });
      if (outOfRange.length > 0) {
        warnings.push(
          `${outOfRange.length} results outside date range: ${outOfRange.map((r) => `"${r.title.slice(0, 30)}..." (${r.publishedDate})`).join(", ")}`
        );
      }
      return warnings;
    },
  },
  {
    name: "Publication type: conference",
    filters: { publicationType: "conference" },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results returned for conference filter");
      }
      return warnings;
    },
  },
  {
    name: "Combined: ACL + 50 citations + 2020 onwards",
    filters: { venues: ["ACL"], minCitationCount: 50, dateFrom: "2020-01-01" },
    validate: (results) => {
      const warnings: string[] = [];
      if (results.length === 0) {
        warnings.push("No results — combined filter may be too strict");
      }
      const belowCitations = results.filter(
        (r) => r.citationCount !== undefined && r.citationCount < 50
      );
      if (belowCitations.length > 0) {
        warnings.push(`${belowCitations.length} results below 50 citations`);
      }
      return warnings;
    },
  },
];

// ── Individual provider tests ──

async function testSemanticScholar() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  SEMANTIC SCHOLAR — Filter Tests             ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();

  // Test 1: venue filter
  console.log("▸ Test: venue=ACL");
  try {
    const result = await searchSemanticScholarPapers({
      query: QUERY,
      apiKey,
      maxResults: 5,
      venue: ["ACL"],
      fallbackToPublicSearchOnForbidden: true,
    });
    console.log(`  ${result.papers.length} results (total: ${result.total ?? "?"})`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | venue=${p.venue ?? "n/a"} | citations=${p.citationCount}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 2: minCitationCount
  console.log("\n▸ Test: minCitationCount=500");
  try {
    const result = await searchSemanticScholarPapers({
      query: QUERY,
      apiKey,
      maxResults: 5,
      minCitationCount: 500,
      fallbackToPublicSearchOnForbidden: true,
    });
    console.log(`  ${result.papers.length} results`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | citations=${p.citationCount}`);
    }
    const below = result.papers.filter((p) => p.citationCount < 500);
    if (below.length > 0) {
      console.log(`  ⚠ ${below.length} papers below 500 citations — filter may not be working`);
    } else {
      console.log(`  ✓ All papers have 500+ citations`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 3: publicationTypes
  console.log("\n▸ Test: publicationTypes=Conference");
  try {
    const result = await searchSemanticScholarPapers({
      query: QUERY,
      apiKey,
      maxResults: 5,
      publicationTypes: ["Conference"],
      fallbackToPublicSearchOnForbidden: true,
    });
    console.log(`  ${result.papers.length} results`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | venue=${p.venue ?? "n/a"}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 4: date range
  console.log("\n▸ Test: publicationDateOrYear=2023-01-01:2024-12-31");
  try {
    const result = await searchSemanticScholarPapers({
      query: QUERY,
      apiKey,
      maxResults: 5,
      publicationDateOrYear: "2023-01-01:2024-12-31",
      fallbackToPublicSearchOnForbidden: true,
    });
    console.log(`  ${result.papers.length} results`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | date=${p.publicationDate ?? "n/a"} | year=${p.year ?? "n/a"}`);
    }
    const outOfRange = result.papers.filter((p) => {
      if (!p.year) return false;
      return p.year < 2023 || p.year > 2024;
    });
    if (outOfRange.length > 0) {
      console.log(`  ⚠ ${outOfRange.length} papers outside 2023-2024 range`);
    } else {
      console.log(`  ✓ All papers within date range`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

async function testOpenAlex() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  OPENALEX — Filter Tests                     ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (!apiKey) {
    console.log("  SKIPPED: OPENALEX_API_KEY not set");
    return;
  }

  // Test 1: venue filter
  console.log("▸ Test: venue=Nature");
  try {
    const results = await searchOpenAlexWorks({
      query: QUERY,
      apiKey,
      perPage: 5,
      venue: ["Nature"],
    });
    console.log(`  ${results.length} results`);
    for (const w of results.slice(0, 3)) {
      console.log(`  · ${w.title.slice(0, 60)}... | source=${w.source ?? "n/a"} | citations=${w.citedByCount}`);
    }
    const natureMatches = results.filter((w) => w.source?.toLowerCase().includes("nature"));
    console.log(`  ${natureMatches.length}/${results.length} from Nature-related venues`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 2: citation count
  console.log("\n▸ Test: minCitationCount=100");
  try {
    const results = await searchOpenAlexWorks({
      query: QUERY,
      apiKey,
      perPage: 5,
      minCitationCount: 100,
    });
    console.log(`  ${results.length} results`);
    for (const w of results.slice(0, 3)) {
      console.log(`  · ${w.title.slice(0, 60)}... | citations=${w.citedByCount}`);
    }
    const below = results.filter((w) => w.citedByCount < 100);
    if (below.length > 0) {
      console.log(`  ⚠ ${below.length} results below 100 citations`);
    } else {
      console.log(`  ✓ All results have 100+ citations`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 3: date range
  console.log("\n▸ Test: fromPublicationDate=2023-01-01, toPublicationDate=2024-12-31");
  try {
    const results = await searchOpenAlexWorks({
      query: QUERY,
      apiKey,
      perPage: 5,
      fromPublicationDate: "2023-01-01",
      toPublicationDate: "2024-12-31",
    });
    console.log(`  ${results.length} results`);
    for (const w of results.slice(0, 3)) {
      console.log(`  · ${w.title.slice(0, 60)}... | date=${w.publicationDate ?? "n/a"} | year=${w.publicationYear ?? "n/a"}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 4: publication type (article — OpenAlex's only relevant type for papers)
  console.log("\n▸ Test: publicationType=article");
  try {
    const results = await searchOpenAlexWorks({
      query: QUERY,
      apiKey,
      perPage: 5,
      publicationType: "article",
    });
    console.log(`  ${results.length} results`);
    for (const w of results.slice(0, 3)) {
      console.log(`  · ${w.title.slice(0, 60)}... | source=${w.source ?? "n/a"}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 5: venue filter with source ID resolution (ACL)
  console.log("\n▸ Test: venue=ACL (resolved via /sources)");
  try {
    const results = await searchOpenAlexWorks({
      query: QUERY,
      apiKey,
      perPage: 5,
      venue: ["ACL"],
    });
    console.log(`  ${results.length} results`);
    for (const w of results.slice(0, 3)) {
      console.log(`  · ${w.title.slice(0, 60)}... | source=${w.source ?? "n/a"} | citations=${w.citedByCount}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

async function testArxiv() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  ARXIV — Filter Tests                        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Test 1: date range (only filter arXiv supports)
  console.log("▸ Test: submittedDateRange 2024-01-01 to 2024-12-31");
  try {
    const result = await searchArxivPapers({
      query: QUERY,
      maxResults: 5,
      submittedDateRange: { from: "20240101", to: "20241231" },
    });
    console.log(`  ${result.papers.length} results (total: ${result.totalResults})`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | published=${p.published?.slice(0, 10) ?? "n/a"} | journal=${p.journalReference ?? "n/a"}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Test 2: category filter
  console.log("\n▸ Test: categories=cs.CL (Computation and Language)");
  try {
    const result = await searchArxivPapers({
      query: QUERY,
      maxResults: 5,
      categories: ["cs.CL"],
    });
    console.log(`  ${result.papers.length} results`);
    for (const p of result.papers.slice(0, 3)) {
      console.log(`  · ${p.title.slice(0, 60)}... | categories=${p.categories.join(",")}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

// ── Unified discovery test ──

async function testUnifiedDiscovery() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  UNIFIED DISCOVERY — Filter Tests            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  for (const tc of TEST_CASES) {
    console.log(`▸ ${tc.name}`);
    console.log(`  filters: ${JSON.stringify(tc.filters)}`);

    try {
      const results = await discoverScholarlySources({
        query: QUERY,
        numResults: 10,
        filters: tc.filters,
      });

      console.log(`  ${results.length} results`);

      // Show top 3
      for (const r of results.slice(0, 3)) {
        const venue = r.venue ? ` | venue=${r.venue}` : "";
        const citations = r.citationCount !== undefined ? ` | citations=${r.citationCount}` : "";
        const date = r.publishedDate ? ` | date=${r.publishedDate}` : "";
        const providers = ` | from=${r.providers.join("+")}`;
        console.log(`  · ${r.title.slice(0, 55)}...${venue}${citations}${date}${providers}`);
      }

      // Run validation
      const warnings = tc.validate(results);
      if (warnings.length > 0) {
        for (const w of warnings) {
          console.log(`  ⚠ ${w}`);
        }
      } else {
        console.log(`  ✓ Passed`);
      }
    } catch (e) {
      console.log(`  ERROR: ${(e as Error).message}`);
    }

    console.log();
  }
}

// ── Baseline comparison ──

async function testBaseline() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  BASELINE — No Filters (control)             ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  try {
    const results = await discoverScholarlySources({
      query: QUERY,
      numResults: 10,
    });

    console.log(`${results.length} results (no filters)`);
    for (const r of results.slice(0, 5)) {
      const venue = r.venue ? ` | venue=${r.venue}` : "";
      const citations = r.citationCount !== undefined ? ` | citations=${r.citationCount}` : "";
      const date = r.publishedDate ? ` | date=${r.publishedDate}` : "";
      const providers = ` | from=${r.providers.join("+")}`;
      console.log(`  · ${r.title.slice(0, 55)}...${venue}${citations}${date}${providers}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

async function main() {
  console.log("Search Filter Validation Test");
  console.log(`Query: "${QUERY}"`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Run baseline first
  await testBaseline();

  // Test each provider individually
  await testSemanticScholar();

  // arXiv has 3-second rate limit
  await new Promise((r) => setTimeout(r, 3500));
  await testArxiv();

  await testOpenAlex();

  // Test the unified discovery layer with filters
  await testUnifiedDiscovery();

  console.log("\n═══ Done ═══\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
