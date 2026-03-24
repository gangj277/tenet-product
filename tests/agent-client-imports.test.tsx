import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client-visible agent context modules import tool schemas directly instead of the tools barrel", () => {
  const chatContext = readRepoFile("lib/agent/chat-context.ts");
  const compaction = readRepoFile("lib/agent/compaction.ts");

  assert.doesNotMatch(chatContext, /from "\.\/tools"/);
  assert.match(chatContext, /from "\.\/tools\/tool-schemas"/);

  assert.doesNotMatch(compaction, /from "\.\/tools"/);
  assert.match(compaction, /from "\.\/tools\/tool-schemas"/);
});
