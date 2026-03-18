/**
 * Graders for the research init pipeline eval.
 *
 * Deterministic graders check artifact structure, length, citations, and errors.
 * LLM judge graders evaluate quality axes: alignment, evidence, research-leverage, non-slop, signals.
 */

import { callLLM } from "../lib/llm/openrouter";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Assertion {
  type: string;
  check?: string;
  value?: string;
  criterion?: string;
}

interface GradeResult {
  check: string;
  passed: boolean;
  reason: string;
}

interface JudgeResult {
  criterion: string;
  score: "pass" | "partial" | "fail";
  reasoning: string;
  votes: string[];
}

// ─── Deterministic Graders ──────────────────────────────────────────────────

// Receives the full pipeline result as `output` — a JSON string of
// { artifacts, errors, status, perspective }
type CheckFn = (output: string, value: string) => { passed: boolean; reason: string };

function parseOutput(output: string): Record<string, unknown> {
  try {
    return JSON.parse(output);
  } catch {
    return {};
  }
}

const CHECKS: Record<string, CheckFn> = {
  artifacts_exist: (output, value) => {
    const data = parseOutput(output);
    const artifacts = data.artifacts as Record<string, unknown> | undefined;
    if (!artifacts) return { passed: false, reason: "No artifacts object in output" };

    const required = value.split(",").map((s) => s.trim());
    const missing = required.filter((k) => !artifacts[k]);

    if (missing.length === 0) {
      return { passed: true, reason: `All ${required.length} artifacts present` };
    }
    return { passed: false, reason: `Missing artifacts: ${missing.join(", ")}` };
  },

  synthesis_min_length: (output, value) => {
    const data = parseOutput(output);
    const artifacts = data.artifacts as Record<string, string> | undefined;
    const synthesis = artifacts?.synthesis ?? "";
    const minLen = parseInt(value, 10);
    const actual = synthesis.length;
    return {
      passed: actual >= minLen,
      reason: `synthesis.md: ${actual} chars (min: ${minLen})`,
    };
  },

  claims_min_length: (output, value) => {
    const data = parseOutput(output);
    const artifacts = data.artifacts as Record<string, string> | undefined;
    const claims = artifacts?.claims ?? "";
    const minLen = parseInt(value, 10);
    const actual = claims.length;
    return {
      passed: actual >= minLen,
      reason: `claims.md: ${actual} chars (min: ${minLen})`,
    };
  },

  has_citations: (output, value) => {
    const data = parseOutput(output);
    const artifacts = data.artifacts as Record<string, string> | undefined;
    const targetArtifact = value.trim();
    const content = artifacts?.[targetArtifact] ?? "";

    // Count total citation occurrences across all patterns
    const citationPatterns = [
      /\[Source:[^\]]*\]/gi,
      /\[\d+\]/g,
      /\([A-Z][a-z]+ et al\.[^\)]*\)/g,
      /\([\d]{4}\)/g,
    ];

    let totalCitations = 0;
    for (const pattern of citationPatterns) {
      const matches = content.match(pattern);
      if (matches) totalCitations += matches.length;
    }

    const passed = totalCitations >= 3;
    return {
      passed,
      reason: `${targetArtifact}: ${totalCitations} citation occurrences found (need ≥3)`,
    };
  },

  no_fatal_errors: (output) => {
    const data = parseOutput(output);
    const status = data.status as string | undefined;
    const errors = (data.errors as Array<{ step: string; message: string }>) ?? [];

    if (status === "failed") {
      return { passed: false, reason: `Run failed: ${errors[0]?.message ?? "unknown"}` };
    }

    const fatalErrors = errors.filter(
      (e) =>
        e.message.includes("Cannot proceed") ||
        e.message.includes("required") ||
        e.message.includes("No sources could be parsed")
    );

    if (fatalErrors.length > 0) {
      return { passed: false, reason: `Fatal errors: ${fatalErrors.map((e) => e.message).join("; ")}` };
    }

    return { passed: true, reason: `Status: ${status}, ${errors.length} non-fatal errors` };
  },
};

export function runDeterministicGraders(
  output: string,
  assertions: Assertion[]
): GradeResult[] {
  return assertions
    .filter((a) => a.type === "deterministic")
    .map((a) => {
      const check = a.check ?? "";
      const fn = CHECKS[check];
      if (!fn) return { check, passed: false, reason: `Unknown check: ${check}` };
      const { passed, reason } = fn(output, a.value ?? "");
      return { check, passed, reason };
    });
}

// ─── LLM Judge ──────────────────────────────────────────────────────────────

export async function runLlmJudge(
  taskInput: string,
  agentOutput: string,
  criterion: string,
  model: string = "anthropic/claude-sonnet-4",
  votes: number = 3
): Promise<JudgeResult> {
  const voteResults: { score: string; reasoning: string }[] = [];

  for (let i = 0; i < votes; i++) {
    const result = await callJudge(taskInput, agentOutput, criterion, model);
    voteResults.push(result);
  }

  // Majority vote
  const scores = voteResults.map((v) => v.score);
  let winner: "pass" | "partial" | "fail" = "partial";
  for (const s of ["pass", "fail", "partial"] as const) {
    if (scores.filter((x) => x === s).length > scores.length / 2) {
      winner = s;
      break;
    }
  }

  const majorityReasoning =
    voteResults.find((v) => v.score === winner)?.reasoning ??
    voteResults[0].reasoning;

  return { criterion, score: winner, reasoning: majorityReasoning, votes: scores };
}

async function callJudge(
  taskInput: string,
  agentOutput: string,
  criterion: string,
  model: string
): Promise<{ score: string; reasoning: string }> {
  // Parse the output to get artifacts for the judge
  const data = parseOutput(agentOutput);
  const artifacts = data.artifacts as Record<string, string> | undefined;
  const perspective = data.perspective as Record<string, unknown> | undefined;

  // Build a readable summary for the judge — not the raw JSON
  const artifactSummary = artifacts
    ? [
        "## overview.md",
        (artifacts.overview ?? "").slice(0, 3000),
        "\n## synthesis.md",
        (artifacts.synthesis ?? "").slice(0, 8000),
        "\n## claims.md",
        (artifacts.claims ?? "").slice(0, 4000),
        "\n## gaps.md",
        (artifacts.gaps ?? "").slice(0, 3000),
        "\n## next-steps.md",
        (artifacts.nextSteps ?? "").slice(0, 2000),
      ].join("\n")
    : "NO ARTIFACTS GENERATED";

  const perspectiveSummary = perspective
    ? JSON.stringify(perspective, null, 2)
    : "NO PERSPECTIVE";

  const prompt = `You are evaluating the output of a research initialization engine against a specific quality criterion.

## Research Question Given to Engine
${taskInput}

## Inferred Research Perspective
${perspectiveSummary}

## Generated Artifacts
${artifactSummary}

## Quality Criterion
${criterion}

## Instructions
1. Carefully analyze the generated artifacts against the criterion above.
2. Consider what the success criteria document says about this type of quality.
3. Explain your reasoning step by step, citing specific examples from the artifacts.
4. Give your verdict as exactly one of: PASS, PARTIAL, FAIL

PASS = clearly meets the criterion
PARTIAL = partially meets the criterion but with notable gaps
FAIL = does not meet the criterion

## Your Evaluation
Reasoning:`;

  const response = await callLLM({
    model,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2048,
    temperature: 0,
  });

  const text = response.content;

  // Extract verdict — look for last occurrence of PASS/PARTIAL/FAIL
  const matches = text.match(/\b(PASS|PARTIAL|FAIL)\b/gi);
  const score = matches ? matches[matches.length - 1].toLowerCase() : "partial";

  return { score, reasoning: text };
}
