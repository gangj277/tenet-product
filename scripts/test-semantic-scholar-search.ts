import { loadEnvConfig } from "@next/env";
import { searchSemanticScholarPapers } from "../lib/discovery/semantic-scholar";

loadEnvConfig(process.cwd());

const DEFAULT_QUERIES = [
  "retrieval augmented generation",
  "model collapse synthetic data",
];

async function main() {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  const queries = process.argv.slice(2);
  const activeQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;

  if (!apiKey) {
    console.warn(
      "SEMANTIC_SCHOLAR_API_KEY is not set; continuing without x-api-key."
    );
  }

  for (const query of activeQueries) {
    console.log(`\n=== Semantic Scholar bulk query: ${query} ===\n`);

    const result = await searchSemanticScholarPapers({
      query,
      apiKey,
      maxResults: 5,
      sort: "citationCount:desc",
      fallbackToPublicSearchOnForbidden: true,
    });

    console.log(
      `estimated_total=${result.total ?? "unknown"} next_token=${result.token ?? "none"}`
    );
    if (result.usedPublicFallback) {
      console.log(
        "warning=keyed request returned 403; public bulk endpoint was used instead"
      );
    }

    if (result.papers.length === 0) {
      console.log("No results.");
      continue;
    }

    for (const [index, paper] of result.papers.entries()) {
      const year = paper.year ? ` (${paper.year})` : "";
      const venue = paper.venue ? ` — ${paper.venue}` : "";
      console.log(`${index + 1}. ${paper.title}${year}${venue}`);
      console.log(
        `   citations=${paper.citationCount} influential=${paper.influentialCitationCount} source_kind=${paper.sourceUrlKind}`
      );
      console.log(`   source=${paper.sourceUrl}`);
      console.log(`   extractor=${paper.extractorUrl}`);
      if (paper.pdfUrl) {
        console.log(`   pdf=${paper.pdfUrl}`);
      }
      console.log(`   s2=${paper.semanticScholarUrl}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
