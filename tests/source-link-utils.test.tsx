import assert from "node:assert/strict";
import test from "node:test";

import type { PaperQualityMeta } from "../lib/discovery/paper-quality.ts";

function makePaperQualityMeta(
  ids?: Partial<NonNullable<PaperQualityMeta["ids"]>>
): PaperQualityMeta {
  return {
    publication: {},
    metrics: {},
    hints: { labels: [] },
    flags: {},
    ids: ids ?? {},
  };
}

test("source link helpers prefer explicit source URLs and normalize DOI fallbacks", async () => {
  const linkUtils = await import(
    "../app/dashboard/[runId]/_components/viewer/source-link-utils.ts"
  );

  assert.equal(
    linkUtils.getPrimarySourceUrl({
      sourceUrl: "https://publisher.example/paper",
      paperQuality: makePaperQualityMeta({ doi: "10.1000/fallback" }),
    }),
    "https://publisher.example/paper"
  );

  assert.equal(
    linkUtils.getPrimarySourceUrl({
      paperQuality: makePaperQualityMeta({ doi: "10.1000/fallback" }),
    }),
    "https://doi.org/10.1000/fallback"
  );

  assert.equal(
    linkUtils.getPrimarySourceUrl({
      paperQuality: makePaperQualityMeta({
        doi: "https://doi.org/10.1000/already-normalized",
      }),
    }),
    "https://doi.org/10.1000/already-normalized"
  );

  assert.equal(
    linkUtils.getPrimarySourceUrl({
      paperQuality: makePaperQualityMeta(),
    }),
    null
  );
});

test("source link helpers expose arxiv PDF URLs when an arxiv id is present", async () => {
  const linkUtils = await import(
    "../app/dashboard/[runId]/_components/viewer/source-link-utils.ts"
  );

  assert.equal(
    linkUtils.getArxivPdfUrl(
      makePaperQualityMeta({ arxivId: "2405.16506v3" })
    ),
    "https://arxiv.org/pdf/2405.16506v3"
  );

  assert.equal(linkUtils.getArxivPdfUrl(makePaperQualityMeta()), null);
});
