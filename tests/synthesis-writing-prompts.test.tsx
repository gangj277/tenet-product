import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaimsPrompt,
  buildGapsPrompt,
  buildNextStepsPrompt,
  buildOverviewPrompt,
  buildSynthesisPrompt,
} from "../lib/engine/prompts/synthesis-writing";
import { buildFinalFindingsMergePrompt } from "../lib/engine/prompts/consolidation";

test("core artifact prompts require concise researcher-first structures", () => {
  const overviewPrompt = buildOverviewPrompt();
  const synthesisPrompt = buildSynthesisPrompt();
  const claimsPrompt = buildClaimsPrompt();
  const gapsPrompt = buildGapsPrompt();
  const nextStepsPrompt = buildNextStepsPrompt();

  assert.match(overviewPrompt, /# Overview/);
  assert.match(overviewPrompt, /## In Brief/);
  assert.match(overviewPrompt, /## Source Base/);

  assert.match(synthesisPrompt, /# Synthesis/);
  assert.match(synthesisPrompt, /## Bottom Line/);
  assert.match(synthesisPrompt, /## What Supports It/);
  assert.match(synthesisPrompt, /## What Weakens It/);
  assert.match(synthesisPrompt, /Write for a researcher who needs the answer quickly/);

  assert.match(claimsPrompt, /complete distinct claims inventory/i);
  assert.match(claimsPrompt, /include all meaningful non-overlapping canonical claims/i);
  assert.match(claimsPrompt, /do not drop a meaningful claim just to stay concise/i);

  assert.match(gapsPrompt, /# Gaps/);
  assert.match(gapsPrompt, /## What The Evidence Does Not Settle/);
  assert.match(nextStepsPrompt, /# Next Steps/);
  assert.match(nextStepsPrompt, /4-6 concrete next actions/i);
});

test("final findings merge prompt forbids omission for brevity and over-merging", () => {
  const prompt = buildFinalFindingsMergePrompt();

  assert.match(prompt, /Do NOT over-merge/);
  assert.match(prompt, /Do NOT drop a meaningful distinct claim just to keep the output short/);
  assert.match(prompt, /Return all meaningful non-overlapping claims supported by the evidence/);
});
