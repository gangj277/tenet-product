import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = "/Users/gangjimin/Documents/main_dev/startup-ideas/research-cursor/research-cursor-product";

test("analyze-evidence structured-output schemas satisfy OpenAI strict required-field rules", async () => {
  const source = await readFile(
    path.join(REPO_ROOT, "lib/engine/nodes/analyze-evidence.ts"),
    "utf8"
  );

  const citationMatch = source.match(
    /const CITATION_SCHEMA =[\s\S]*?required:\s*\[([\s\S]*?)\]/
  );
  assert.ok(citationMatch, "CITATION_SCHEMA required array should exist");
  const citationRequired = citationMatch[1] ?? "";
  assert.match(citationRequired, /"location"/);
  assert.match(citationRequired, /"quote"/);

  const claimMatch = source.match(
    /const DIGEST_CLAIM_SCHEMA =[\s\S]*?required:\s*\[([\s\S]*?)\]/
  );
  assert.ok(claimMatch, "DIGEST_CLAIM_SCHEMA required array should exist");
  const claimRequired = claimMatch[1] ?? "";
  for (const field of [
    "claimSignature",
    "claim",
    "subquestion",
    "stance",
    "confidence",
    "citations",
    "caveats",
  ]) {
    assert.match(
      claimRequired,
      new RegExp(`"${field}"`),
      `DIGEST_CLAIM_SCHEMA must require ${field}`
    );
  }
});
