import assert from "node:assert/strict";
import test from "node:test";

test("searchOpenAlexWorks sends the API key and normalizes work results", async () => {
  const requests: URL[] = [];

  const { searchOpenAlexWorks } = await import("../lib/discovery/openalex.ts");

  const results = await searchOpenAlexWorks({
    query: "retrieval augmented generation",
    apiKey: "openalex-test-key",
    perPage: 3,
    fetchImpl: async (input) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      requests.push(url);

      return new Response(
        JSON.stringify({
          results: [
            {
              id: "https://openalex.org/W123",
              title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
              publication_year: 2021,
              publication_date: "2021-05-01",
              cited_by_count: 4321,
              doi: "https://doi.org/10.1000/example",
              primary_location: {
                source: { display_name: "NeurIPS" },
                landing_page_url: "https://example.com/paper",
                pdf_url: "https://example.com/paper.pdf",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.origin, "https://api.openalex.org");
  assert.equal(requests[0]?.pathname, "/works");
  assert.equal(requests[0]?.searchParams.get("search"), "retrieval augmented generation");
  assert.equal(requests[0]?.searchParams.get("per_page"), "3");
  assert.equal(requests[0]?.searchParams.get("api_key"), "openalex-test-key");
  assert.match(requests[0]?.searchParams.get("select") ?? "", /title/);

  assert.deepEqual(results, [
    {
      id: "https://openalex.org/W123",
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
      publicationYear: 2021,
      publicationDate: "2021-05-01",
      citedByCount: 4321,
      doi: "https://doi.org/10.1000/example",
      source: "NeurIPS",
      landingPageUrl: "https://example.com/paper",
      pdfUrl: "https://example.com/paper.pdf",
    },
  ]);
});
