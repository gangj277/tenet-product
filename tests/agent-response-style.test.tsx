import assert from "node:assert/strict";
import test from "node:test";

test("default agent directive requires conclusion-first concise user-facing responses", async () => {
  const constitution = await import("../lib/agent/prompts/constitution.ts");

  const directive = constitution.buildDefaultDirective();

  assert.match(directive, /lead with the conclusion/i);
  assert.match(directive, /brief by default/i);
  assert.match(directive, /do not overwhelm the user/i);
  assert.match(directive, /only expand when the user asks/i);
});
