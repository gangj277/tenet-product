/**
 * Research Init Pipeline — Evaluation Runner
 *
 * Runs the pipeline against test fixtures and evaluates output quality
 * using deterministic graders + LLM judge (5 quality axes per fixture).
 *
 * Usage:
 *   npx tsx evals/run_eval.ts                     # Run all cases
 *   npx tsx evals/run_eval.ts --case tc-001       # Run specific case
 *   npx tsx evals/run_eval.ts --tag medical-glp1  # Run cases by tag
 *   npx tsx evals/run_eval.ts --no-judge          # Skip LLM judge (fast)
 *   npx tsx evals/run_eval.ts --compare previous  # Compare against previous run
 */

import dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local before anything else so API keys are available
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runAgent, type AgentResult } from "./agent_adapter";
import { runDeterministicGraders, runLlmJudge } from "./graders";
import {
  Tracer,
  analyzeTrajectory,
  type TraceStep,
} from "./trajectory_analyzer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  name?: string;
  input: string;
  context?: Record<string, unknown>;
  expected_outcome?: string;
  assertions?: Assertion[];
  tags?: string[];
  budget?: { max_tokens?: number; timeout_seconds?: number };
}

interface Assertion {
  type: "deterministic" | "llm_judge";
  check?: string;
  value?: string;
  criterion?: string;
}

interface CaseResult {
  case_id: string;
  case_name: string;
  status: "pass" | "fail" | "error" | "timeout" | "budget_exceeded";
  output: string;
  trajectory: Record<string, unknown>[];
  grades: Record<string, unknown>;
  metrics: Record<string, unknown>;
  error?: string;
}

interface EvalConfig {
  agent_module: string;
  agent_function: string;
  isolation: string;
  trajectory: {
    enabled: boolean;
    analyze_tool_selection: boolean;
    detect_loops: boolean;
    max_steps: number;
  };
  grading: {
    deterministic: boolean;
    llm_judge: {
      enabled: boolean;
      model: string;
      criteria_per_call: number;
      votes: number;
    };
  };
  budgets: {
    max_tokens_per_case: number;
    max_cost_usd_per_case: number;
    timeout_seconds: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const evalsDir = __dirname;

function loadConfig(): EvalConfig {
  return JSON.parse(readFileSync(join(evalsDir, "config.json"), "utf-8"));
}

function loadTestCases(caseId?: string, tag?: string): TestCase[] {
  const data = JSON.parse(
    readFileSync(join(evalsDir, "test_cases.json"), "utf-8")
  );
  let cases: TestCase[] = data.cases;
  if (caseId) cases = cases.filter((c) => c.id === caseId);
  if (tag) cases = cases.filter((c) => c.tags?.includes(tag));
  return cases;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runSingleCase(
  testCase: TestCase,
  config: EvalConfig,
  skipJudge: boolean
): Promise<CaseResult> {
  const caseId = testCase.id;
  const caseName = testCase.name ?? caseId;
  const timeout =
    (testCase.budget?.timeout_seconds ?? config.budgets.timeout_seconds) * 1000;

  const tracer = new Tracer();

  try {
    const start = Date.now();

    // Run with timeout
    let result: AgentResult;
    try {
      result = await Promise.race([
        runAgent(testCase.input, testCase.context, tracer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeout)
        ),
      ]);
    } catch (e) {
      if (e instanceof Error && e.message === "TIMEOUT") {
        return {
          case_id: caseId,
          case_name: caseName,
          status: "timeout",
          output: "",
          trajectory: [],
          grades: {},
          metrics: { timeout_seconds: timeout / 1000 },
          error: `Agent exceeded ${timeout / 1000}s timeout`,
        };
      }
      throw e;
    }

    const durationMs = Date.now() - start;
    const trajectory = tracer.steps.map((s) => ({ ...s }));

    // Parse metadata
    const metadata = result.metadata ?? {};

    // ── Deterministic grading ──
    const detGrades = runDeterministicGraders(
      result.output,
      (testCase.assertions ?? []).filter((a) => a.type === "deterministic")
    );

    // ── LLM judge grading ──
    const judgeConfig = config.grading.llm_judge;
    const judgeGrades: Record<string, unknown>[] = [];

    if (judgeConfig.enabled && !skipJudge) {
      const llmAssertions = (testCase.assertions ?? []).filter(
        (a) => a.type === "llm_judge"
      );

      // Build a readable task description from the fixture input
      const outputData = JSON.parse(result.output);
      const perspectiveStr = outputData.perspective
        ? `Research Question: ${outputData.perspective.briefSummary ?? ""}\nFrame: ${outputData.perspective.inferredResearchFrame ?? ""}`
        : testCase.input;

      console.log(
        `\n    Running ${llmAssertions.length} LLM judge evaluations (${judgeConfig.votes} votes each)...`
      );

      for (const assertion of llmAssertions) {
        const criterionShort = assertion.criterion!.split(":")[0] ?? "Judge";
        process.stdout.write(`      ${criterionShort}... `);

        const grade = await runLlmJudge(
          perspectiveStr,
          result.output,
          assertion.criterion!,
          judgeConfig.model,
          judgeConfig.votes
        );
        judgeGrades.push(grade as unknown as Record<string, unknown>);

        const symbol =
          grade.score === "pass"
            ? "✓"
            : grade.score === "partial"
              ? "~"
              : "✗";
        console.log(
          `${symbol} ${grade.score.toUpperCase()} [${grade.votes.join(",")}]`
        );
      }
    }

    // ── Trajectory analysis ──
    const trajAnalysis = config.trajectory.enabled
      ? analyzeTrajectory(
          tracer.steps,
          config.trajectory.detect_loops,
          config.trajectory.analyze_tool_selection
        )
      : {};

    // ── Overall status ──
    const allDetPassed = detGrades.every((g) => g.passed);
    const allJudgePassed =
      skipJudge ||
      judgeGrades.every(
        (g) =>
          (g as { score: string }).score === "pass" ||
          (g as { score: string }).score === "partial"
      );
    const anyJudgeFail = judgeGrades.some(
      (g) => (g as { score: string }).score === "fail"
    );
    const status = allDetPassed && !anyJudgeFail ? "pass" : "fail";

    return {
      case_id: caseId,
      case_name: caseName,
      status,
      output: result.output,
      trajectory,
      grades: {
        deterministic: detGrades,
        llm_judge: judgeGrades,
        trajectory: trajAnalysis,
      },
      metrics: {
        total_duration_ms: durationMs,
        phase1_duration_ms: metadata.phase1DurationMs,
        phase2_duration_ms: metadata.phase2DurationMs,
        parsed_sources: metadata.parsedSourceCount,
        discovered_sources: metadata.discoveredSourceCount,
        uploaded_sources: metadata.uploadedSourceCount,
        pipeline_status: metadata.status,
        has_artifacts: metadata.hasArtifacts,
        error_count: metadata.errorCount,
        costs: metadata.costs,
      },
    };
  } catch (e) {
    return {
      case_id: caseId,
      case_name: caseName,
      status: "error",
      output: "",
      trajectory: [],
      grades: {},
      metrics: {},
      error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e),
    };
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

function generateSummary(results: CaseResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.status === "pass").length;
  const durations = results.map(
    (r) => ((r.metrics as Record<string, number>).total_duration_ms ?? 0)
  );

  const stats = (vals: number[]) => ({
    mean: vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0,
    min: vals.length ? Math.min(...vals) : 0,
    max: vals.length ? Math.max(...vals) : 0,
  });

  // Aggregate costs across all cases
  let totalCostUsd = 0;
  let totalApiCalls = 0;
  const modelCosts: Record<string, { calls: number; costUsd: number }> = {};
  for (const r of results) {
    const costs = (r.metrics as Record<string, unknown>).costs as
      | { totalCostUsd: number; totalCalls: number; byModel: Record<string, { calls: number; totalCostUsd: number }> }
      | undefined;
    if (costs) {
      totalCostUsd += costs.totalCostUsd;
      totalApiCalls += costs.totalCalls;
      for (const [model, usage] of Object.entries(costs.byModel)) {
        if (!modelCosts[model]) modelCosts[model] = { calls: 0, costUsd: 0 };
        modelCosts[model].calls += usage.calls;
        modelCosts[model].costUsd += usage.totalCostUsd;
      }
    }
  }

  // Collect LLM judge results per criterion type
  const criterionResults: Record<
    string,
    { pass: number; partial: number; fail: number }
  > = {};
  for (const r of results) {
    const grades = r.grades as Record<string, unknown>;
    const judgeGrades = (grades.llm_judge ?? []) as Array<{
      criterion: string;
      score: string;
    }>;
    for (const g of judgeGrades) {
      const key = g.criterion.split(":")[0] ?? "unknown";
      if (!criterionResults[key]) {
        criterionResults[key] = { pass: 0, partial: 0, fail: 0 };
      }
      criterionResults[key][g.score as "pass" | "partial" | "fail"]++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    total_cases: total,
    passed,
    failed: results.filter((r) => r.status === "fail").length,
    errors: results.filter((r) => r.status === "error").length,
    timeouts: results.filter((r) => r.status === "timeout").length,
    pass_rate: total
      ? Math.round((passed / total) * 1000) / 1000
      : 0,
    duration_ms: stats(durations),
    costs: {
      total_usd: totalCostUsd,
      per_case_avg_usd: total ? totalCostUsd / total : 0,
      total_api_calls: totalApiCalls,
      by_model: modelCosts,
    },
    criterion_breakdown: criterionResults,
    failures: results
      .filter((r) => r.status !== "pass")
      .map((r) => ({
        case_id: r.case_id,
        name: r.case_name,
        status: r.status,
        error: r.error?.slice(0, 200),
        failed_deterministic: (
          (r.grades as Record<string, unknown>).deterministic as Array<{
            check: string;
            passed: boolean;
            reason: string;
          }>
        )
          ?.filter((g) => !g.passed)
          .map((g) => `${g.check}: ${g.reason}`),
        failed_judge: (
          (r.grades as Record<string, unknown>).llm_judge as Array<{
            criterion: string;
            score: string;
          }>
        )
          ?.filter((g) => g.score === "fail")
          .map((g) => `${g.criterion.split(":")[0]}: FAIL`),
      })),
  };
}

function printSummary(summary: ReturnType<typeof generateSummary>) {
  console.log("\n" + "═".repeat(70));
  console.log(`  EVAL RESULTS — ${summary.timestamp}`);
  console.log("═".repeat(70));
  console.log(
    `  Overall: ${summary.passed}/${summary.total_cases} passed (${(summary.pass_rate * 100).toFixed(0)}%)`
  );
  if (summary.failed)
    console.log(`  Failed:  ${summary.failed}`);
  if (summary.errors)
    console.log(`  Errors:  ${summary.errors}`);
  if (summary.timeouts)
    console.log(`  Timeout: ${summary.timeouts}`);
  console.log(
    `\n  Duration: mean=${(summary.duration_ms.mean / 1000).toFixed(1)}s min=${(summary.duration_ms.min / 1000).toFixed(1)}s max=${(summary.duration_ms.max / 1000).toFixed(1)}s`
  );

  // Cost breakdown
  const costs = summary.costs as { total_usd: number; per_case_avg_usd: number; total_api_calls: number; by_model: Record<string, { calls: number; costUsd: number }> };
  if (costs.total_api_calls > 0) {
    console.log(`\n  Costs:`);
    console.log(`    Total:    $${costs.total_usd.toFixed(4)}`);
    console.log(`    Per case: $${costs.per_case_avg_usd.toFixed(4)} avg`);
    console.log(`    API calls: ${costs.total_api_calls}`);
    console.log(`    By model:`);
    for (const [model, usage] of Object.entries(costs.by_model)) {
      console.log(`      ${model}: ${usage.calls} calls, $${usage.costUsd.toFixed(4)}`);
    }
  }

  // Criterion breakdown
  const cb = summary.criterion_breakdown;
  if (Object.keys(cb).length > 0) {
    console.log(`\n  Quality Axes:`);
    for (const [criterion, counts] of Object.entries(cb)) {
      const total = counts.pass + counts.partial + counts.fail;
      const bar =
        "█".repeat(counts.pass) +
        "▓".repeat(counts.partial) +
        "░".repeat(counts.fail);
      console.log(
        `    ${criterion.padEnd(18)} ${bar} ${counts.pass}P/${counts.partial}A/${counts.fail}F (of ${total})`
      );
    }
  }

  if (summary.failures.length) {
    console.log(`\n  FAILURES:`);
    for (const f of summary.failures) {
      console.log(`\n    [${f.status.toUpperCase()}] ${f.case_id}: ${f.name}`);
      if (f.error) console.log(`      Error: ${f.error}`);
      if (f.failed_deterministic?.length) {
        console.log(`      Deterministic failures:`);
        for (const d of f.failed_deterministic) {
          console.log(`        - ${d}`);
        }
      }
      if (f.failed_judge?.length) {
        console.log(`      Judge failures:`);
        for (const j of f.failed_judge) {
          console.log(`        - ${j}`);
        }
      }
    }
  }

  console.log("\n" + "═".repeat(70) + "\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const caseId = args.includes("--case")
    ? args[args.indexOf("--case") + 1]
    : undefined;
  const tag = args.includes("--tag")
    ? args[args.indexOf("--tag") + 1]
    : undefined;
  const compare = args.includes("--compare")
    ? args[args.indexOf("--compare") + 1]
    : undefined;
  const skipJudge = args.includes("--no-judge");

  const config = loadConfig();
  const cases = loadTestCases(caseId, tag);

  if (!cases.length) {
    console.log("No test cases found matching criteria.");
    process.exit(0);
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  Research Init Pipeline — Evaluation Suite                   ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  Cases: ${String(cases.length).padEnd(52)}║`);
  console.log(`║  Judge: ${(skipJudge ? "disabled (--no-judge)" : `${config.grading.llm_judge.model} × ${config.grading.llm_judge.votes} votes`).padEnd(52)}║`);
  console.log(`║  Timeout: ${String(config.budgets.timeout_seconds + "s per case").padEnd(50)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  const results: CaseResult[] = [];
  for (const tc of cases) {
    console.log(`\n▸ [${tc.id}] ${tc.name ?? tc.input}`);
    console.log(`  Running pipeline for fixture: ${tc.input}...`);

    const startTime = Date.now();
    const result = await runSingleCase(tc, config, skipJudge);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const symbol =
      result.status === "pass"
        ? "✓"
        : result.status === "error"
          ? "✗"
          : "⚠";
    console.log(`\n  ${symbol} ${result.status.toUpperCase()} in ${elapsed}s`);

    // Print cost breakdown
    const costs = (result.metrics as Record<string, unknown>).costs as
      | { totalCostUsd: number; totalCalls: number; totalInputTokens: number; totalOutputTokens: number; byModel: Record<string, { calls: number; totalCostUsd: number }> }
      | undefined;
    if (costs) {
      console.log(`  Cost: $${costs.totalCostUsd.toFixed(4)} (${costs.totalCalls} API calls, ${costs.totalInputTokens} in / ${costs.totalOutputTokens} out)`);
      for (const [model, usage] of Object.entries(costs.byModel)) {
        console.log(`    ${model}: ${usage.calls} calls, $${usage.totalCostUsd.toFixed(4)}`);
      }
    }

    // Print deterministic grades
    const detGrades = (
      result.grades as Record<string, unknown>
    ).deterministic as Array<{ check: string; passed: boolean; reason: string }>;
    if (detGrades?.length) {
      console.log(`  Deterministic checks:`);
      for (const g of detGrades) {
        console.log(
          `    ${g.passed ? "✓" : "✗"} ${g.check}: ${g.reason}`
        );
      }
    }

    results.push(result);
  }

  // Save results
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15);
  const runDir = join(evalsDir, "results", `run-${timestamp}`);
  mkdirSync(runDir, { recursive: true });

  for (const r of results) {
    // Save per-case result (truncate output to avoid huge files)
    const saveResult = {
      ...r,
      output: r.output.slice(0, 5000) + (r.output.length > 5000 ? "\n...[truncated]" : ""),
    };
    writeFileSync(
      join(runDir, `${r.case_id}.json`),
      JSON.stringify(saveResult, null, 2)
    );

    // Save full artifacts separately for manual review
    if (r.output) {
      try {
        const outputData = JSON.parse(r.output);
        if (outputData.artifacts) {
          const artifactsDir = join(runDir, r.case_id, "artifacts");
          mkdirSync(artifactsDir, { recursive: true });
          for (const [name, content] of Object.entries(outputData.artifacts)) {
            if (typeof content === "string") {
              writeFileSync(join(artifactsDir, `${name}.md`), content);
            } else if (typeof content === "object" && content !== null) {
              // sources is Record<string, string>
              const sourcesDir = join(artifactsDir, "sources");
              mkdirSync(sourcesDir, { recursive: true });
              for (const [srcId, srcContent] of Object.entries(
                content as Record<string, string>
              )) {
                writeFileSync(
                  join(sourcesDir, `${srcId}.md`),
                  srcContent
                );
              }
            }
          }
        }
      } catch {
        // Skip artifact extraction on parse error
      }
    }
  }

  const summary = generateSummary(results);
  writeFileSync(
    join(runDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  printSummary(summary);

  // Comparison
  if (compare) {
    const resultsDir = join(evalsDir, "results");
    let comparePath = compare;
    if (compare === "previous") {
      const runs = readdirSync(resultsDir)
        .filter(
          (d) => d.startsWith("run-") && d !== `run-${timestamp}`
        )
        .sort();
      comparePath = runs.length
        ? join(resultsDir, runs[runs.length - 1])
        : "";
    }
    const prevSummaryPath = join(comparePath, "summary.json");
    if (existsSync(prevSummaryPath)) {
      const prev = JSON.parse(readFileSync(prevSummaryPath, "utf-8"));
      console.log("\n  COMPARISON vs PREVIOUS:");
      console.log(
        `  Pass rate: ${(prev.pass_rate * 100).toFixed(0)}% → ${(summary.pass_rate * 100).toFixed(0)}%`
      );
      console.log(
        `  Avg time:  ${(prev.duration_ms.mean / 1000).toFixed(1)}s → ${(summary.duration_ms.mean / 1000).toFixed(1)}s`
      );
    }
  }

  console.log(`Results saved to: ${runDir}`);

  // Exit with appropriate code
  const allPassed = results.every((r) => r.status === "pass");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
