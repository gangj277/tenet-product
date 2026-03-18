import { searchArxivPapers } from "../lib/discovery/arxiv";

const DEFAULT_QUERIES = [
  "retrieval augmented generation",
  "diffusion model alignment",
];

const ARXIV_MIN_INTERVAL_MS = 3000;

async function main() {
  const queries = process.argv.slice(2);
  const activeQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;

  for (const [index, query] of activeQueries.entries()) {
    console.log(`\n=== arXiv query: ${query} ===\n`);

    const result = await searchArxivPapers({
      query,
      maxResults: 5,
      sortBy: "relevance",
      sortOrder: "descending",
    });

    console.log(
      `total_results=${result.totalResults} start_index=${result.startIndex} items_per_page=${result.itemsPerPage}`
    );

    if (result.papers.length === 0) {
      console.log("No results.");
    }

    for (const [paperIndex, paper] of result.papers.entries()) {
      const primaryCategory = paper.primaryCategory
        ? ` primary_category=${paper.primaryCategory}`
        : "";
      console.log(`${paperIndex + 1}. ${paper.title}`);
      console.log(
        `   arxiv_id=${paper.arxivId}${primaryCategory} published=${paper.published ?? "unknown"}`
      );
      console.log(`   source=${paper.sourceUrl}`);
      console.log(`   extractor=${paper.extractorUrl}`);
      if (paper.pdfUrl) {
        console.log(`   pdf=${paper.pdfUrl}`);
      }
    }

    if (index < activeQueries.length - 1) {
      await sleep(ARXIV_MIN_INTERVAL_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
