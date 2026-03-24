/**
 * MODEL_LIGHT Comparison Eval — compares two models on the 4 synthesis prompts.
 *
 * Usage:
 *   npx tsx evals/compare-model-light.ts                        # All 3 fixtures, with judge
 *   npx tsx evals/compare-model-light.ts ai-model-collapse      # Single fixture
 *   npx tsx evals/compare-model-light.ts --no-judge             # Metrics only (fast)
 *   npx tsx evals/compare-model-light.ts --refresh              # Re-run pipeline for fresh context
 */

import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local before any module that reads process.env at call time
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { callLLM, type LLMResponse } from "../lib/llm/runtime";
import { initGraph } from "../lib/engine/graph";
import { generateId } from "../lib/utils/id";
import { memoryStore } from "../lib/storage/memory-store";
import { Command } from "@langchain/langgraph";
import {
  buildOverviewPrompt,
  buildClaimsPrompt,
  buildGapsPrompt,
  buildNextStepsPrompt,
} from "../lib/engine/prompts/synthesis-writing";
import type {
  UserInput,
  Perspective,
  ConsolidatedFindings,
  SourceEntry,
} from "../lib/engine/state";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_A = "google/gemini-3.1-flash-lite-preview"; // current
const MODEL_B = "openai/gpt-5.4-nano"; // candidate

const MODEL_JUDGE = "anthropic/claude-sonnet-4";
const JUDGE_VOTES = 3;

/** Per-million-token pricing (computed locally, independent of MODEL_PRICING) */
const EVAL_PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_A]: { input: 0.25, output: 1.5 },
  [MODEL_B]: { input: 0.1, output: 0.4 },
};

const ALL_FIXTURES = [
  "ai-model-collapse",
  "operations-research-routing",
  "medical-glp1-obesity",
];

interface TaskDef {
  name: string;
  buildPrompt: () => string;
  maxTokens: number;
}

const TASKS: TaskDef[] = [
  { name: "overview", buildPrompt: buildOverviewPrompt, maxTokens: 4096 },
  { name: "claims", buildPrompt: buildClaimsPrompt, maxTokens: 8192 },
  { name: "gaps", buildPrompt: buildGapsPrompt, maxTokens: 4096 },
  { name: "next-steps", buildPrompt: buildNextStepsPrompt, maxTokens: 4096 },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface SynthesisContext {
  input: UserInput;
  perspective: Perspective;
  consolidatedFindings: ConsolidatedFindings;
}

interface Snapshot {
  fixtureId: string;
  capturedAt: string;
  runId: string;
  context: SynthesisContext;
}

interface CallMetrics {
  model: string;
  task: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  outputLength: number;
}

interface JudgeVerdict {
  task: string;
  scores: { modelA: number; modelB: number };
  winner: "A" | "B" | "tie";
  reasoning: string;
  votes: Array<{ winner: "A" | "B" | "tie"; scoreA: number; scoreB: number }>;
}

interface FixtureResult {
  fixtureId: string;
  metrics: CallMetrics[];
  outputs: Record<string, { modelA: string; modelB: string }>;
  grades: JudgeVerdict[];
}

// ─── Fixture Loading (mirrors agent_adapter.ts) ────────────────────────────

const FIXTURES_ROOT = resolve(__dirname, "../../fixtures/project-init");

interface FixtureSourceDef {
  filename: string;
  title: string;
  year: number;
  sourceType: string;
  landingUrl: string;
  pdfUrl: string;
}

async function loadFixture(fixtureId: string) {
  const dir = resolve(FIXTURES_ROOT, fixtureId);
  const input: UserInput = JSON.parse(
    await readFile(resolve(dir, "input.json"), "utf-8")
  );
  const sourceDefs: FixtureSourceDef[] = JSON.parse(
    await readFile(resolve(dir, "sources.json"), "utf-8")
  );

  const sources: SourceEntry[] = [];
  for (const s of sourceDefs) {
    const pdfPath = resolve(dir, "pdfs", s.filename);
    try {
      const buffer = await readFile(pdfPath);
      const sourceId = generateId();
      const storageKey = `eval/${fixtureId}/${s.filename}`;
      memoryStore.saveFile(storageKey, buffer);
      sources.push({
        sourceId,
        name: s.title,
        origin: "uploaded" as const,
        mimeType: "application/pdf",
        checksum: "",
        storageUrl: storageKey,
        parseStatus: "pending" as const,
      });
    } catch {
      console.warn(`  ⚠ PDF not found: ${pdfPath}`);
    }
  }
  return { input, sources };
}

// ─── Context Capture ────────────────────────────────────────────────────────

function snapshotPath(fixtureId: string): string {
  return resolve(__dirname, "snapshots", `${fixtureId}.json`);
}

async function captureContext(
  fixtureId: string,
  refresh: boolean
): Promise<SynthesisContext> {
  const path = snapshotPath(fixtureId);

  if (!refresh && existsSync(path)) {
    console.log(`  📂 Loading snapshot: ${fixtureId}`);
    const snapshot: Snapshot = JSON.parse(await readFile(path, "utf-8"));
    return snapshot.context;
  }

  console.log(`  🔄 Running pipeline for: ${fixtureId} (this takes a few minutes)...`);
  const { input, sources } = await loadFixture(fixtureId);

  const projectId = generateId();
  const runId = generateId();
  const config = { configurable: { thread_id: runId } };

  // Phase 1: Run graph until interrupt at confirm_inferred_brief
  await initGraph.invoke(
    {
      projectId,
      runId,
      userId: "eval-compare",
      status: "queued" as const,
      input,
      sources,
    },
    config
  );

  // Phase 2: Accept the brief and run the rest — catch DB errors from persist_project
  try {
    await initGraph.invoke(
      new Command({ resume: { action: "accept" } }),
      config
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // persist_project / DB failures are expected outside the app — ignore and extract state
    console.log(`  ⚠ Pipeline error (extracting state anyway): ${msg.slice(0, 120)}`);
  }

  // Extract state from checkpointer — has everything up to the last successful node
  const state = await initGraph.getState(config);
  const vals = state.values as Record<string, unknown>;

  const context: SynthesisContext = {
    input: vals.input as UserInput,
    perspective: vals.perspective as Perspective,
    consolidatedFindings: vals.consolidatedFindings as ConsolidatedFindings,
  };

  if (!context.perspective || !context.consolidatedFindings) {
    const stateKeys = Object.keys(vals).filter((k) => vals[k] != null && vals[k] !== undefined);
    throw new Error(
      `Pipeline did not produce perspective/consolidatedFindings for ${fixtureId}. ` +
      `Available state keys: [${stateKeys.join(", ")}], status: ${vals.status}`
    );
  }

  const snapshot: Snapshot = {
    fixtureId,
    capturedAt: new Date().toISOString(),
    runId,
    context,
  };

  await writeFile(path, JSON.stringify(snapshot, null, 2));
  console.log(`  💾 Saved snapshot: ${path}`);

  return context;
}

// ─── Run Prompt ─────────────────────────────────────────────────────────────

function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = EVAL_PRICING[model] ?? { input: 0.5, output: 3.0 };
  return (
    (promptTokens * pricing.input) / 1_000_000 +
    (completionTokens * pricing.output) / 1_000_000
  );
}

async function runPrompt(
  model: string,
  task: TaskDef,
  context: SynthesisContext
): Promise<{ response: LLMResponse; metrics: CallMetrics }> {
  const contextStr = JSON.stringify(
    {
      input: context.input,
      perspective: context.perspective,
      consolidatedFindings: context.consolidatedFindings,
    },
    null,
    2
  );

  const response = await callLLM({
    model,
    messages: [
      { role: "system", content: task.buildPrompt() },
      { role: "user", content: contextStr },
    ],
    maxTokens: task.maxTokens,
  });

  const metrics: CallMetrics = {
    model,
    task: task.name,
    latencyMs: response.latencyMs,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    costUsd: computeCost(
      model,
      response.usage.promptTokens,
      response.usage.completionTokens
    ),
    outputLength: response.content.length,
  };

  return { response, metrics };
}

// ─── Judge ──────────────────────────────────────────────────────────────────

const JUDGE_CRITERIA: Record<string, string> = {
  overview: `Evaluate these two overview documents for a research project.
Judge on:
1. COMPLETENESS: Does it include all 5 expected sections (research question, interpreted objective, research frame, scope boundaries, source inventory)?
2. CLARITY: Is the research frame clearly articulated?
3. SOURCE INVENTORY: Are sources listed accurately with provenance?
4. FIDELITY: Is the content faithful to the consolidated findings (no hallucinated claims)?
5. NON-SLOP: Is the content topic-specific and non-generic?`,

  claims: `Evaluate these two claims documents for a research project.
Judge on:
1. CLAIM SPECIFICITY: Are claims precise and well-delineated (not vague or merged)?
2. CITATION QUALITY: Are supporting and contradicting sources cited by name?
3. CONFIDENCE CALIBRATION: Are high/medium/low ratings justified, not random?
4. STRENGTH ORDERING: Are claims ordered strongest-to-weakest evidence?
5. FIDELITY: Do claims reflect the consolidated findings accurately?
6. NON-SLOP: Are claims topic-specific, not generic truisms?`,

  gaps: `Evaluate these two gaps documents for a research project.
Judge on:
1. ACTIONABILITY: Are gaps specific enough for a researcher to act on?
2. CONTRADICTION COVERAGE: Are source disagreements surfaced?
3. EVIDENCE QUALITY FLAGS: Are weak-evidence areas identified?
4. FIDELITY: Do the gaps match what the consolidated findings actually leave unresolved?
5. NON-SLOP: Are the gaps topic-specific, not boilerplate research caveats?`,

  "next-steps": `Evaluate these two next-steps documents for a research project.
Judge on:
1. CONCRETENESS: Are suggestions specific enough to act on (named papers, methods, datasets)?
2. RELEVANCE: Do next steps address the identified gaps?
3. NON-GENERIC: Would these suggestions only make sense for THIS research topic?
4. FIDELITY: Are suggestions grounded in what the evidence actually shows?
5. NON-SLOP: Would a domain expert find these useful vs. obvious boilerplate?`,
};

async function judgeComparison(
  task: string,
  context: SynthesisContext,
  outputA: string,
  outputB: string
): Promise<JudgeVerdict> {
  const criteria = JUDGE_CRITERIA[task] ?? "Evaluate quality, fidelity, and specificity.";
  const votes: Array<{ winner: "A" | "B" | "tie"; scoreA: number; scoreB: number }> = [];

  for (let i = 0; i < JUDGE_VOTES; i++) {
    // Randomly swap positions to mitigate position bias
    const swapped = Math.random() < 0.5;
    const first = swapped ? outputB : outputA;
    const second = swapped ? outputA : outputB;
    const firstLabel = swapped ? "Response B" : "Response A";
    const secondLabel = swapped ? "Response A" : "Response B";

    const prompt = `You are comparing two LLM outputs for the "${task}" artifact of a research project.

## Research Context
Question: ${context.input.researchQuestion}
Frame: ${context.perspective.inferredResearchFrame}

## Criteria
${criteria}

## ${firstLabel}
${first.slice(0, 6000)}

## ${secondLabel}
${second.slice(0, 6000)}

## Instructions
1. Score each response on each criterion (1-5 scale).
2. Compute an overall score (1-5) for each response.
3. Declare a winner or tie.

Respond in EXACTLY this format:
SCORE_A: <number 1-5>
SCORE_B: <number 1-5>
WINNER: <A|B|TIE>
REASONING: <2-3 sentences explaining your verdict>`;

    const response = await callLLM({
      model: MODEL_JUDGE,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
      temperature: 0.2,
    });

    const text = response.content;
    const scoreAMatch = text.match(/SCORE_A:\s*(\d(?:\.\d)?)/);
    const scoreBMatch = text.match(/SCORE_B:\s*(\d(?:\.\d)?)/);
    const winnerMatch = text.match(/WINNER:\s*(A|B|TIE)/i);

    let rawScoreFirst = scoreAMatch ? parseFloat(scoreAMatch[1]) : 3;
    let rawScoreSecond = scoreBMatch ? parseFloat(scoreBMatch[1]) : 3;

    // Un-swap scores if positions were swapped
    const scoreA = swapped ? rawScoreSecond : rawScoreFirst;
    const scoreB = swapped ? rawScoreFirst : rawScoreSecond;

    let rawWinner = (winnerMatch?.[1]?.toUpperCase() ?? "TIE") as "A" | "B" | "TIE";
    // Un-swap winner
    let winner: "A" | "B" | "tie";
    if (rawWinner === "TIE") {
      winner = "tie";
    } else if (swapped) {
      winner = rawWinner === "A" ? "B" : "A";
    } else {
      winner = rawWinner as "A" | "B";
    }

    votes.push({ winner, scoreA, scoreB });
  }

  // Majority vote on winner
  const winCounts = { A: 0, B: 0, tie: 0 };
  let totalScoreA = 0;
  let totalScoreB = 0;
  for (const v of votes) {
    winCounts[v.winner]++;
    totalScoreA += v.scoreA;
    totalScoreB += v.scoreB;
  }

  let winner: "A" | "B" | "tie" = "tie";
  if (winCounts.A > winCounts.B && winCounts.A > winCounts.tie) winner = "A";
  else if (winCounts.B > winCounts.A && winCounts.B > winCounts.tie) winner = "B";

  const avgScoreA = totalScoreA / votes.length;
  const avgScoreB = totalScoreB / votes.length;

  return {
    task,
    scores: { modelA: Math.round(avgScoreA * 10) / 10, modelB: Math.round(avgScoreB * 10) / 10 },
    winner,
    reasoning: `${winCounts.A}/${JUDGE_VOTES} votes for A, ${winCounts.B}/${JUDGE_VOTES} for B, ${winCounts.tie}/${JUDGE_VOTES} ties. Avg: A=${avgScoreA.toFixed(1)} B=${avgScoreB.toFixed(1)}`,
    votes,
  };
}

// ─── Output & Printing ─────────────────────────────────────────────────────

function printMetricsTable(results: FixtureResult[]) {
  console.log("\n" + "═".repeat(100));
  console.log("  MODEL_LIGHT COMPARISON — METRICS");
  console.log("═".repeat(100));
  console.log(
    `  Model A: ${MODEL_A}`
  );
  console.log(
    `  Model B: ${MODEL_B}`
  );
  console.log("─".repeat(100));

  // Per-fixture breakdown
  for (const r of results) {
    console.log(`\n  📁 ${r.fixtureId}`);
    console.log(
      "  " +
        "Task".padEnd(14) +
        "Model".padEnd(42) +
        "Latency".padStart(9) +
        "Tokens".padStart(10) +
        "Cost".padStart(10) +
        "Chars".padStart(8)
    );
    console.log("  " + "─".repeat(93));

    for (const task of TASKS) {
      const metricsA = r.metrics.find(
        (m) => m.task === task.name && m.model === MODEL_A
      );
      const metricsB = r.metrics.find(
        (m) => m.task === task.name && m.model === MODEL_B
      );

      for (const [label, m] of [
        ["A", metricsA],
        ["B", metricsB],
      ] as const) {
        if (!m) continue;
        const modelTag = label === "A" ? "A (current)" : "B (candidate)";
        console.log(
          "  " +
            (label === "A" ? task.name : "").padEnd(14) +
            modelTag.padEnd(42) +
            `${(m.latencyMs / 1000).toFixed(1)}s`.padStart(9) +
            `${m.promptTokens + m.completionTokens}`.padStart(10) +
            `$${m.costUsd.toFixed(4)}`.padStart(10) +
            `${m.outputLength}`.padStart(8)
        );
      }
    }
  }

  // Aggregate summary
  console.log("\n" + "═".repeat(100));
  console.log("  AGGREGATE");
  console.log("─".repeat(100));

  const allMetrics = results.flatMap((r) => r.metrics);
  const aggA = aggregateMetrics(allMetrics.filter((m) => m.model === MODEL_A));
  const aggB = aggregateMetrics(allMetrics.filter((m) => m.model === MODEL_B));

  console.log(
    `  Model A (current):    ${aggA.calls} calls, ${(aggA.totalLatency / 1000).toFixed(1)}s total, $${aggA.totalCost.toFixed(4)} total`
  );
  console.log(
    `  Model B (candidate):  ${aggB.calls} calls, ${(aggB.totalLatency / 1000).toFixed(1)}s total, $${aggB.totalCost.toFixed(4)} total`
  );

  if (aggA.totalLatency > 0) {
    const latencyDelta = ((aggB.totalLatency - aggA.totalLatency) / aggA.totalLatency) * 100;
    const costDelta = aggA.totalCost > 0 ? ((aggB.totalCost - aggA.totalCost) / aggA.totalCost) * 100 : 0;
    console.log(
      `  Delta:                Latency ${latencyDelta > 0 ? "+" : ""}${latencyDelta.toFixed(0)}%, Cost ${costDelta > 0 ? "+" : ""}${costDelta.toFixed(0)}%`
    );
  }
}

function printJudgeTable(results: FixtureResult[]) {
  console.log("\n" + "═".repeat(100));
  console.log("  MODEL_LIGHT COMPARISON — JUDGE VERDICTS");
  console.log("═".repeat(100));

  for (const r of results) {
    if (r.grades.length === 0) continue;
    console.log(`\n  📁 ${r.fixtureId}`);
    console.log(
      "  " +
        "Task".padEnd(14) +
        "A Score".padStart(9) +
        "B Score".padStart(9) +
        "Winner".padStart(8) +
        "  Votes"
    );
    console.log("  " + "─".repeat(70));

    for (const g of r.grades) {
      const winnerStr =
        g.winner === "A"
          ? "A ✓"
          : g.winner === "B"
            ? "B ✓"
            : "tie";
      console.log(
        "  " +
          g.task.padEnd(14) +
          `${g.scores.modelA}/5`.padStart(9) +
          `${g.scores.modelB}/5`.padStart(9) +
          winnerStr.padStart(8) +
          `  ${g.reasoning}`
      );
    }
  }

  // Overall winner across all fixtures
  const allGrades = results.flatMap((r) => r.grades);
  if (allGrades.length > 0) {
    const wins = { A: 0, B: 0, tie: 0 };
    for (const g of allGrades) wins[g.winner]++;

    console.log("\n" + "─".repeat(100));
    console.log(
      `  OVERALL: A wins ${wins.A}/${allGrades.length}, B wins ${wins.B}/${allGrades.length}, ties ${wins.tie}/${allGrades.length}`
    );

    if (wins.A > wins.B) console.log(`  → Model A (${MODEL_A}) is better overall`);
    else if (wins.B > wins.A) console.log(`  → Model B (${MODEL_B}) is better overall`);
    else console.log("  → Models are roughly equivalent");
  }
}

function aggregateMetrics(metrics: CallMetrics[]) {
  return {
    calls: metrics.length,
    totalLatency: metrics.reduce((s, m) => s + m.latencyMs, 0),
    totalCost: metrics.reduce((s, m) => s + m.costUsd, 0),
    totalTokens: metrics.reduce(
      (s, m) => s + m.promptTokens + m.completionTokens,
      0
    ),
  };
}

// ─── Save Results ───────────────────────────────────────────────────────────

async function saveResults(results: FixtureResult[]) {
  const timestamp = new Date().toISOString().slice(0, 16).replace(":", "");
  const outDir = resolve(__dirname, "results", `compare-${timestamp}`);
  await mkdir(outDir, { recursive: true });

  // Per-fixture artifacts
  for (const r of results) {
    const fixtureDir = resolve(outDir, r.fixtureId);
    await mkdir(fixtureDir, { recursive: true });

    for (const [taskName, outputs] of Object.entries(r.outputs)) {
      await writeFile(resolve(fixtureDir, `${taskName}-modelA.md`), outputs.modelA);
      await writeFile(resolve(fixtureDir, `${taskName}-modelB.md`), outputs.modelB);
    }

    await writeFile(
      resolve(fixtureDir, "metrics.json"),
      JSON.stringify(r.metrics, null, 2)
    );

    if (r.grades.length > 0) {
      await writeFile(
        resolve(fixtureDir, "grades.json"),
        JSON.stringify(r.grades, null, 2)
      );
    }
  }

  // Summary
  const summary = {
    modelA: MODEL_A,
    modelB: MODEL_B,
    timestamp: new Date().toISOString(),
    fixtures: results.map((r) => ({
      fixtureId: r.fixtureId,
      metricsA: aggregateMetrics(r.metrics.filter((m) => m.model === MODEL_A)),
      metricsB: aggregateMetrics(r.metrics.filter((m) => m.model === MODEL_B)),
      judgeWins: r.grades.reduce(
        (acc, g) => {
          acc[g.winner]++;
          return acc;
        },
        { A: 0, B: 0, tie: 0 } as Record<string, number>
      ),
    })),
  };

  await writeFile(
    resolve(outDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n  💾 Results saved to: ${outDir}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const noJudge = args.includes("--no-judge");
  const fixtureArgs = args.filter((a) => !a.startsWith("--"));
  const fixtures =
    fixtureArgs.length > 0
      ? fixtureArgs.filter((f) => ALL_FIXTURES.includes(f))
      : ALL_FIXTURES;

  if (fixtures.length === 0) {
    console.error(
      `Unknown fixture(s). Available: ${ALL_FIXTURES.join(", ")}`
    );
    process.exit(1);
  }

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  MODEL_LIGHT Comparison Eval                            ║");
  console.log(`║  A: ${MODEL_A.padEnd(50)}║`);
  console.log(`║  B: ${MODEL_B.padEnd(50)}║`);
  console.log(`║  Fixtures: ${fixtures.join(", ").padEnd(43)}║`);
  console.log(`║  Judge: ${noJudge ? "disabled" : MODEL_JUDGE}`.padEnd(58) + "║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const results: FixtureResult[] = [];

  for (const fixtureId of fixtures) {
    console.log(`\n▶ Fixture: ${fixtureId}`);
    console.log("─".repeat(60));

    // 1. Capture context
    let context: SynthesisContext;
    try {
      context = await captureContext(fixtureId, refresh);
    } catch (err: unknown) {
      console.error(`  ✗ Skipping fixture: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    console.log(
      `  ✓ Context ready (${context.consolidatedFindings.canonicalClaims.length} claims, ${context.consolidatedFindings.openQuestions.length} open questions)`
    );

    // 2. Run both models on all 4 tasks
    const metrics: CallMetrics[] = [];
    const outputs: Record<string, { modelA: string; modelB: string }> = {};

    for (const task of TASKS) {
      console.log(`  Running: ${task.name}...`);

      const [resultA, resultB] = await Promise.all([
        runPrompt(MODEL_A, task, context),
        runPrompt(MODEL_B, task, context),
      ]);

      metrics.push(resultA.metrics, resultB.metrics);
      outputs[task.name] = {
        modelA: resultA.response.content,
        modelB: resultB.response.content,
      };

      console.log(
        `    A: ${(resultA.metrics.latencyMs / 1000).toFixed(1)}s, ${resultA.metrics.outputLength} chars | ` +
          `B: ${(resultB.metrics.latencyMs / 1000).toFixed(1)}s, ${resultB.metrics.outputLength} chars`
      );
    }

    // 3. Judge (optional)
    const grades: JudgeVerdict[] = [];
    if (!noJudge) {
      console.log("  Judging...");
      for (const task of TASKS) {
        const verdict = await judgeComparison(
          task.name,
          context,
          outputs[task.name].modelA,
          outputs[task.name].modelB
        );
        grades.push(verdict);
        const winStr =
          verdict.winner === "tie"
            ? "TIE"
            : `${verdict.winner === "A" ? MODEL_A.split("/")[1] : MODEL_B.split("/")[1]} wins`;
        console.log(
          `    ${task.name}: A=${verdict.scores.modelA}/5 B=${verdict.scores.modelB}/5 → ${winStr}`
        );
      }
    }

    results.push({ fixtureId, metrics, outputs, grades });
  }

  // 4. Print tables
  printMetricsTable(results);
  if (!noJudge) printJudgeTable(results);

  // 5. Save artifacts
  await saveResults(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
