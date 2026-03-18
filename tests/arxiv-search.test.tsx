import assert from "node:assert/strict";
import test from "node:test";

const SAMPLE_ARXIV_FEED = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns="http://www.w3.org/2005/Atom">
  <id>https://arxiv.org/api/example</id>
  <title>arXiv Query</title>
  <updated>2026-03-18T01:00:00Z</updated>
  <opensearch:itemsPerPage>2</opensearch:itemsPerPage>
  <opensearch:totalResults>123</opensearch:totalResults>
  <opensearch:startIndex>5</opensearch:startIndex>
  <entry>
    <id>http://arxiv.org/abs/2312.10997v1</id>
    <updated>2023-12-18T18:46:04Z</updated>
    <published>2023-12-18T18:46:04Z</published>
    <title>  Retrieval-Augmented Generation for Large Language Models: A Survey  </title>
    <summary>
      This survey reviews retrieval-augmented generation systems.
    </summary>
    <author>
      <name>Yunfan Gao</name>
    </author>
    <author>
      <name>Xinyu Feng</name>
    </author>
    <link href="https://arxiv.org/abs/2312.10997v1" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2312.10997v1" rel="related" type="application/pdf" title="pdf"/>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.IR" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:comment>42 pages, survey</arxiv:comment>
    <arxiv:primary_category term="cs.CL"/>
    <arxiv:journal_ref>arXiv preprint</arxiv:journal_ref>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2005.11401v4</id>
    <updated>2021-05-25T17:07:08Z</updated>
    <published>2020-05-22T17:46:38Z</published>
    <title>Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</title>
    <summary>RAG combines parametric and non-parametric memory.</summary>
    <author>
      <name>Patrick Lewis</name>
    </author>
    <link href="https://arxiv.org/abs/2005.11401v4" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2005.11401v4" rel="related" type="application/pdf" title="pdf"/>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:primary_category term="cs.CL"/>
  </entry>
</feed>`;

test("searchArxivPapers builds a fielded query and normalizes Atom entries", async () => {
  const requests: URL[] = [];

  const { searchArxivPapers } = await import("../lib/discovery/arxiv.ts");

  const result = await searchArxivPapers({
    query: "retrieval augmented generation",
    categories: ["cs.CL", "cs.IR"],
    submittedDateRange: {
      from: "202401010000",
      to: "202612312359",
    },
    start: 5,
    maxResults: 2,
    sortBy: "lastUpdatedDate",
    sortOrder: "descending",
    fetchImpl: async (input) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      requests.push(url);

      return new Response(SAMPLE_ARXIV_FEED, {
        status: 200,
        headers: {
          "content-type": "application/atom+xml; charset=utf-8",
        },
      });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.origin, "https://export.arxiv.org");
  assert.equal(requests[0]?.pathname, "/api/query");
  assert.equal(
    requests[0]?.searchParams.get("search_query"),
    '(ti:"retrieval augmented generation" OR abs:"retrieval augmented generation") AND (cat:cs.CL OR cat:cs.IR) AND submittedDate:[202401010000 TO 202612312359]'
  );
  assert.equal(requests[0]?.searchParams.get("start"), "5");
  assert.equal(requests[0]?.searchParams.get("max_results"), "2");
  assert.equal(requests[0]?.searchParams.get("sortBy"), "lastUpdatedDate");
  assert.equal(requests[0]?.searchParams.get("sortOrder"), "descending");

  assert.deepEqual(result, {
    totalResults: 123,
    startIndex: 5,
    itemsPerPage: 2,
    papers: [
      {
        id: "https://arxiv.org/abs/2312.10997v1",
        arxivId: "2312.10997v1",
        title: "Retrieval-Augmented Generation for Large Language Models: A Survey",
        summary: "This survey reviews retrieval-augmented generation systems.",
        published: "2023-12-18T18:46:04Z",
        updated: "2023-12-18T18:46:04Z",
        authors: ["Yunfan Gao", "Xinyu Feng"],
        categories: ["cs.CL", "cs.IR"],
        primaryCategory: "cs.CL",
        comment: "42 pages, survey",
        journalReference: "arXiv preprint",
        sourceUrl: "https://arxiv.org/abs/2312.10997v1",
        landingPageUrl: "https://arxiv.org/abs/2312.10997v1",
        pdfUrl: "https://arxiv.org/pdf/2312.10997v1",
        extractorUrl: "https://arxiv.org/pdf/2312.10997v1",
      },
      {
        id: "https://arxiv.org/abs/2005.11401v4",
        arxivId: "2005.11401v4",
        title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        summary: "RAG combines parametric and non-parametric memory.",
        published: "2020-05-22T17:46:38Z",
        updated: "2021-05-25T17:07:08Z",
        authors: ["Patrick Lewis"],
        categories: ["cs.CL"],
        primaryCategory: "cs.CL",
        comment: undefined,
        journalReference: undefined,
        sourceUrl: "https://arxiv.org/abs/2005.11401v4",
        landingPageUrl: "https://arxiv.org/abs/2005.11401v4",
        pdfUrl: "https://arxiv.org/pdf/2005.11401v4",
        extractorUrl: "https://arxiv.org/pdf/2005.11401v4",
      },
    ],
  });
});

test("searchArxivPapers uses default relevance sorting and supports raw search queries", async () => {
  const requests: URL[] = [];

  const { searchArxivPapers } = await import("../lib/discovery/arxiv.ts");

  const result = await searchArxivPapers({
    rawSearchQuery: 'cat:cs.LG AND all:"diffusion model"',
    fetchImpl: async (input) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      requests.push(url);

      return new Response(
        `<?xml version='1.0' encoding='UTF-8'?>
        <feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns="http://www.w3.org/2005/Atom">
          <opensearch:itemsPerPage>0</opensearch:itemsPerPage>
          <opensearch:totalResults>0</opensearch:totalResults>
          <opensearch:startIndex>0</opensearch:startIndex>
        </feed>`,
        {
          status: 200,
          headers: {
            "content-type": "application/atom+xml; charset=utf-8",
          },
        }
      );
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.searchParams.get("search_query"),
    'cat:cs.LG AND all:"diffusion model"'
  );
  assert.equal(requests[0]?.searchParams.get("sortBy"), "relevance");
  assert.equal(requests[0]?.searchParams.get("sortOrder"), "descending");
  assert.equal(result.totalResults, 0);
  assert.equal(result.papers.length, 0);
});
