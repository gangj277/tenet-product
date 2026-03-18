import assert from "node:assert/strict";
import test from "node:test";

test("discoverScholarlySources merges provider results into deduped extractor-ready sources", async () => {
  const openAlexCalls: string[] = [];
  const semanticScholarCalls: string[] = [];
  const arxivCalls: string[] = [];

  const { discoverScholarlySources } = await import(
    "../lib/discovery/scholarly-search.ts"
  );

  const results = await discoverScholarlySources({
    query: "retrieval augmented generation",
    queryVariations: ["knowledge intensive generation"],
    numResults: 3,
    openAlexApiKey: "openalex-key",
    semanticScholarApiKey: "semantic-key",
    clients: {
      searchOpenAlexWorks: async ({ query }) => {
        openAlexCalls.push(query);

        if (query === "retrieval augmented generation") {
          return [
            {
              id: "https://openalex.org/W1",
              title: "Retrieval-Augmented Generation for Large Language Models: A Survey",
              publicationYear: 2024,
              publicationDate: "2024-01-10",
              citedByCount: 180,
              doi: "https://doi.org/10.1000/rag-survey",
              source: "ACL Anthology",
              landingPageUrl: "https://publisher.example/rag-survey",
            },
          ];
        }

        return [
          {
            id: "https://openalex.org/W2",
            title: "Grounding Language Models with Better Retrieval",
            publicationYear: 2023,
            publicationDate: "2023-06-01",
            citedByCount: 50,
            doi: "https://doi.org/10.1000/grounding",
            source: "ICLR",
            landingPageUrl: "https://publisher.example/grounding",
            pdfUrl: "https://publisher.example/grounding.pdf",
          },
        ];
      },
      searchSemanticScholarPapers: async ({ query }) => {
        semanticScholarCalls.push(query);

        if (query === "retrieval augmented generation") {
          return {
            total: 2,
            token: undefined,
            usedPublicFallback: false,
            papers: [
              {
                paperId: "paper-doi",
                title:
                  "Retrieval-Augmented Generation for Large Language Models: A Survey",
                venue: "ACL Anthology",
                year: 2024,
                publicationDate: "2024-01-10",
                citationCount: 220,
                influentialCitationCount: 20,
                referenceCount: 87,
                semanticScholarUrl:
                  "https://www.semanticscholar.org/paper/paper-doi",
                sourceUrl: "https://doi.org/10.1000/rag-survey",
                sourceUrlKind: "doi",
                landingPageUrl: "https://doi.org/10.1000/rag-survey",
                pdfUrl: "https://publisher.example/rag-survey.pdf",
                extractorUrl: "https://publisher.example/rag-survey.pdf",
                externalIds: {
                  DOI: "10.1000/rag-survey",
                },
              },
              {
                paperId: "paper-arxiv",
                title: "Graph Retrieval-Augmented Generation",
                venue: "arXiv.org",
                year: 2024,
                publicationDate: "2024-05-26",
                citationCount: 120,
                influentialCitationCount: 10,
                referenceCount: 49,
                semanticScholarUrl:
                  "https://www.semanticscholar.org/paper/paper-arxiv",
                sourceUrl: "https://arxiv.org/abs/2405.16506v3",
                sourceUrlKind: "arxiv",
                landingPageUrl: "https://arxiv.org/abs/2405.16506v3",
                pdfUrl: "https://arxiv.org/pdf/2405.16506v3",
                extractorUrl: "https://arxiv.org/pdf/2405.16506v3",
                externalIds: {
                  ArXiv: "2405.16506v3",
                },
              },
              {
                paperId: "paper-s2-fallback",
                title: "Metadata-only Paper",
                venue: "Unknown",
                year: 2025,
                publicationDate: "2025-01-01",
                citationCount: 5,
                influentialCitationCount: 0,
                referenceCount: 12,
                semanticScholarUrl:
                  "https://www.semanticscholar.org/paper/paper-s2-fallback",
                sourceUrl:
                  "https://www.semanticscholar.org/paper/paper-s2-fallback",
                sourceUrlKind: "semantic_scholar",
                landingPageUrl:
                  "https://www.semanticscholar.org/paper/paper-s2-fallback",
                pdfUrl: undefined,
                extractorUrl:
                  "https://www.semanticscholar.org/paper/paper-s2-fallback",
                externalIds: {},
              },
            ],
          };
        }

        return {
          total: 0,
          token: undefined,
          usedPublicFallback: false,
          papers: [],
        };
      },
      searchArxivPapers: async ({ query }) => {
        arxivCalls.push(query);

        return {
          totalResults: 1,
          startIndex: 0,
          itemsPerPage: 1,
          papers: [
            {
              id: "https://arxiv.org/abs/2405.16506v3",
              arxivId: "2405.16506v3",
              title: "GRAG: Graph Retrieval-Augmented Generation",
              summary: "Graph-based retrieval augmented generation.",
              published: "2024-05-26T10:11:40Z",
              updated: "2024-06-03T01:00:00Z",
              authors: ["Example Author"],
              categories: ["cs.LG"],
              primaryCategory: "cs.LG",
              sourceUrl: "https://arxiv.org/abs/2405.16506v3",
              landingPageUrl: "https://arxiv.org/abs/2405.16506v3",
              pdfUrl: "https://arxiv.org/pdf/2405.16506v3",
              extractorUrl: "https://arxiv.org/pdf/2405.16506v3",
            },
          ],
        };
      },
    },
  });

  assert.deepEqual(openAlexCalls, [
    "retrieval augmented generation",
    "knowledge intensive generation",
  ]);
  assert.deepEqual(semanticScholarCalls, [
    "retrieval augmented generation",
    "knowledge intensive generation",
  ]);
  assert.deepEqual(arxivCalls, ["retrieval augmented generation"]);

  assert.equal(results.length, 3);

  assert.deepEqual(results[0], {
    title: "Retrieval-Augmented Generation for Large Language Models: A Survey",
    url: "https://publisher.example/rag-survey",
    pdfUrl: "https://publisher.example/rag-survey.pdf",
    publishedDate: "2024-01-10",
    author: undefined,
    provider: "openalex",
    providers: ["openalex", "semantic-scholar"],
    doi: "10.1000/rag-survey",
    arxivId: undefined,
    citationCount: 220,
    venue: "ACL Anthology",
    paperQuality: {
      ids: {
        doi: "10.1000/rag-survey",
        openAlexId: "https://openalex.org/W1",
        semanticScholarPaperId: "paper-doi",
      },
      publication: {
        year: 2024,
        date: "2024-01-10",
        venue: "ACL Anthology",
      },
      metrics: {
        citationCount: 220,
        influentialCitationCount: 20,
        referenceCount: 87,
        providerCount: 2,
      },
      flags: {
        openAccess: true,
        preprint: false,
      },
      hints: {
        signalScore: 90,
        labels: ["Highly cited", "Influential", "Open access", "Cross-indexed"],
      },
    },
  });

  assert.deepEqual(results[1], {
    title: "Graph Retrieval-Augmented Generation",
    url: "https://arxiv.org/abs/2405.16506v3",
    pdfUrl: "https://arxiv.org/pdf/2405.16506v3",
    publishedDate: "2024-05-26",
    author: "Example Author",
    provider: "semantic-scholar",
    providers: ["semantic-scholar", "arxiv"],
    doi: undefined,
    arxivId: "2405.16506v3",
    citationCount: 120,
    venue: "arXiv.org",
    paperQuality: {
      ids: {
        semanticScholarPaperId: "paper-arxiv",
        arxivId: "2405.16506v3",
      },
      publication: {
        year: 2024,
        date: "2024-05-26",
        venue: "arXiv.org",
      },
      metrics: {
        citationCount: 120,
        influentialCitationCount: 10,
        referenceCount: 49,
        providerCount: 2,
      },
      flags: {
        openAccess: true,
        preprint: true,
      },
      hints: {
        signalScore: 95,
        labels: [
          "Highly cited",
          "Influential",
          "Open access",
          "Preprint",
          "Cross-indexed",
        ],
      },
    },
  });

  assert.deepEqual(results[2], {
    title: "Grounding Language Models with Better Retrieval",
    url: "https://publisher.example/grounding",
    pdfUrl: "https://publisher.example/grounding.pdf",
    publishedDate: "2023-06-01",
    author: undefined,
    provider: "openalex",
    providers: ["openalex"],
    doi: "10.1000/grounding",
    arxivId: undefined,
    citationCount: 50,
    venue: "ICLR",
    paperQuality: {
      ids: {
        doi: "10.1000/grounding",
        openAlexId: "https://openalex.org/W2",
      },
      publication: {
        year: 2023,
        date: "2023-06-01",
        venue: "ICLR",
      },
      metrics: {
        citationCount: 50,
        providerCount: 1,
      },
      flags: {
        openAccess: true,
        preprint: false,
      },
      hints: {
        signalScore: 35,
        labels: ["Open access"],
      },
    },
  });
});
