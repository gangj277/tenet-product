import assert from "node:assert/strict";
import test from "node:test";

test("searchSemanticScholarPapers uses bulk search and normalizes extractor-ready URLs", async () => {
  const requests: Array<{ url: URL; headers: Headers }> = [];

  const { searchSemanticScholarPapers } = await import(
    "../lib/discovery/semantic-scholar.ts"
  );

  const result = await searchSemanticScholarPapers({
    query: "retrieval augmented generation",
    apiKey: "semantic-scholar-test-key",
    maxResults: 3,
    sort: "citationCount:desc",
    minCitationCount: 100,
    fieldsOfStudy: ["Computer Science"],
    fetchImpl: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const headers = new Headers(init?.headers);
      requests.push({ url, headers });

      return new Response(
        JSON.stringify({
          total: 3,
          token: "next-page-token",
          data: [
            {
              paperId: "paper-doi",
              title: "What Makes Good In-Context Examples for GPT-3?",
              url: "https://www.semanticscholar.org/paper/paper-doi",
              externalIds: {
                DOI: "10.18653/v1/2022.deelio-1.10",
                ArXiv: "2101.06804",
              },
              openAccessPdf: {
                url: "https://aclanthology.org/2022.deelio-1.10.pdf",
              },
              venue:
                "Workshop on Knowledge Extraction and Integration for Deep Learning Architectures",
              year: 2021,
              publicationDate: "2021-01-17",
              citationCount: 1674,
              influentialCitationCount: 183,
              referenceCount: 104,
            },
            {
              paperId: "paper-arxiv",
              title: "Retrieval-Augmented Generation for Large Language Models: A Survey",
              url: "https://www.semanticscholar.org/paper/paper-arxiv",
              externalIds: {
                ArXiv: "2312.10997",
              },
              openAccessPdf: {
                url: "",
              },
              venue: "arXiv.org",
              year: 2023,
              publicationDate: "2023-12-18",
              citationCount: 2996,
              influentialCitationCount: 185,
              referenceCount: 122,
            },
            {
              paperId: "paper-fallback",
              title: "Closed-Access Example",
              url: "https://www.semanticscholar.org/paper/paper-fallback",
              externalIds: {},
              venue: "Unknown",
              year: 2024,
              publicationDate: "2024-05-01",
              citationCount: 12,
              influentialCitationCount: 1,
              referenceCount: 18,
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
  assert.equal(requests[0]?.url.origin, "https://api.semanticscholar.org");
  assert.equal(requests[0]?.url.pathname, "/graph/v1/paper/search/bulk");
  assert.equal(
    requests[0]?.url.searchParams.get("query"),
    "retrieval augmented generation"
  );
  assert.equal(requests[0]?.url.searchParams.get("sort"), "citationCount:desc");
  assert.equal(requests[0]?.url.searchParams.get("minCitationCount"), "100");
  assert.equal(
    requests[0]?.url.searchParams.get("fieldsOfStudy"),
    "Computer Science"
  );
  assert.match(requests[0]?.url.searchParams.get("fields") ?? "", /externalIds/);
  assert.equal(
    requests[0]?.headers.get("x-api-key"),
    "semantic-scholar-test-key"
  );

  assert.deepEqual(result, {
    total: 3,
    token: "next-page-token",
    usedPublicFallback: false,
    papers: [
      {
        paperId: "paper-doi",
        title: "What Makes Good In-Context Examples for GPT-3?",
        venue:
          "Workshop on Knowledge Extraction and Integration for Deep Learning Architectures",
        year: 2021,
        publicationDate: "2021-01-17",
        citationCount: 1674,
        influentialCitationCount: 183,
        referenceCount: 104,
        semanticScholarUrl: "https://www.semanticscholar.org/paper/paper-doi",
        sourceUrl: "https://doi.org/10.18653/v1/2022.deelio-1.10",
        sourceUrlKind: "doi",
        landingPageUrl: "https://doi.org/10.18653/v1/2022.deelio-1.10",
        pdfUrl: "https://aclanthology.org/2022.deelio-1.10.pdf",
        extractorUrl: "https://aclanthology.org/2022.deelio-1.10.pdf",
        externalIds: {
          DOI: "10.18653/v1/2022.deelio-1.10",
          ArXiv: "2101.06804",
        },
      },
      {
        paperId: "paper-arxiv",
        title: "Retrieval-Augmented Generation for Large Language Models: A Survey",
        venue: "arXiv.org",
        year: 2023,
        publicationDate: "2023-12-18",
        citationCount: 2996,
        influentialCitationCount: 185,
        referenceCount: 122,
        semanticScholarUrl: "https://www.semanticscholar.org/paper/paper-arxiv",
        sourceUrl: "https://arxiv.org/abs/2312.10997",
        sourceUrlKind: "arxiv",
        landingPageUrl: "https://arxiv.org/abs/2312.10997",
        pdfUrl: "https://arxiv.org/pdf/2312.10997.pdf",
        extractorUrl: "https://arxiv.org/pdf/2312.10997.pdf",
        externalIds: {
          ArXiv: "2312.10997",
        },
      },
      {
        paperId: "paper-fallback",
        title: "Closed-Access Example",
        venue: "Unknown",
        year: 2024,
        publicationDate: "2024-05-01",
        citationCount: 12,
        influentialCitationCount: 1,
        referenceCount: 18,
        semanticScholarUrl: "https://www.semanticscholar.org/paper/paper-fallback",
        sourceUrl: "https://www.semanticscholar.org/paper/paper-fallback",
        sourceUrlKind: "semantic_scholar",
        landingPageUrl: "https://www.semanticscholar.org/paper/paper-fallback",
        pdfUrl: undefined,
        extractorUrl: "https://www.semanticscholar.org/paper/paper-fallback",
        externalIds: {},
      },
    ],
  });
});

test("searchSemanticScholarPapers can call the public bulk endpoint without an API key", async () => {
  const requests: Array<{ url: URL; headers: Headers }> = [];

  const { searchSemanticScholarPapers } = await import(
    "../lib/discovery/semantic-scholar.ts"
  );

  await searchSemanticScholarPapers({
    query: "language model evaluation",
    fetchImpl: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const headers = new Headers(init?.headers);
      requests.push({ url, headers });

      return new Response(
        JSON.stringify({
          total: 0,
          data: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.headers.has("x-api-key"), false);
});

test("searchSemanticScholarPapers can retry without the API key after a forbidden response", async () => {
  const requests: Array<{ url: URL; headers: Headers }> = [];

  const { searchSemanticScholarPapers } = await import(
    "../lib/discovery/semantic-scholar.ts"
  );

  const result = await searchSemanticScholarPapers({
    query: "retrieval augmented generation",
    apiKey: "semantic-scholar-test-key",
    fallbackToPublicSearchOnForbidden: true,
    fetchImpl: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const headers = new Headers(init?.headers);
      requests.push({ url, headers });

      if (headers.has("x-api-key")) {
        return new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          total: 1,
          data: [
            {
              paperId: "paper-public",
              title: "Public Fallback Result",
              url: "https://www.semanticscholar.org/paper/paper-public",
              externalIds: { ArXiv: "2404.16130" },
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

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.headers.get("x-api-key"), "semantic-scholar-test-key");
  assert.equal(requests[1]?.headers.has("x-api-key"), false);
  assert.equal(result.usedPublicFallback, true);
  assert.equal(result.papers[0]?.extractorUrl, "https://arxiv.org/pdf/2404.16130.pdf");
});
