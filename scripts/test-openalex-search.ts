import { loadEnvConfig } from "@next/env";
import { searchOpenAlexWorks } from "../lib/discovery/openalex";

loadEnvConfig(process.cwd());

const DEFAULT_QUERIES = [
  "retrieval augmented generation",
  "model collapse synthetic data",
];

async function main() {
  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENALEX_API_KEY is not set");
  }

  const queries = process.argv.slice(2);
  const activeQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;

  for (const query of activeQueries) {
    console.log(`\n=== OpenAlex query: ${query} ===\n`);

    const works = await searchOpenAlexWorks({
      query,
      apiKey,
      perPage: 5,
    });

    if (works.length === 0) {
      console.log("No results.");
      continue;
    }

    for (const [index, work] of works.entries()) {
      const year = work.publicationYear ? ` (${work.publicationYear})` : "";
      const source = work.source ? ` — ${work.source}` : "";
      const citations = `citations=${work.citedByCount}`;
      const doi = work.doi ? ` doi=${work.doi}` : "";
      const pdf = work.pdfUrl ? ` pdf=${work.pdfUrl}` : "";
      const landing = work.landingPageUrl ? ` landing=${work.landingPageUrl}` : "";

      console.log(`${index + 1}. ${work.title}${year}${source}`);
      console.log(`   ${citations}${doi}`);
      console.log(`   id=${work.id}${landing}${pdf}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
