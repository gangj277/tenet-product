/**
 * Agent Adapter — bridges the research init pipeline to the eval runner.
 *
 * The init pipeline is a LangGraph state graph with interrupt-based human-in-the-loop.
 * This adapter:
 *   1. Loads fixture data (input.json, sources.json, PDFs)
 *   2. Runs the graph to interrupt (nodes 1-3)
 *   3. Auto-accepts the inferred brief
 *   4. Runs the rest of the pipeline (nodes 4-9)
 *   5. Returns structured output with all artifacts
 */

import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initGraph } from "../lib/engine/graph";
import { generateId } from "../lib/utils/id";
import { memoryStore } from "../lib/storage/memory-store";
import { Command } from "@langchain/langgraph";
import type { UserInput, SourceEntry } from "../lib/engine/state";
import { costTracker } from "../lib/llm/runtime";
import type { Tracer } from "./trajectory_analyzer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = resolve(__dirname, "../../fixtures/project-init");

export interface AgentResult {
  /** JSON-stringified full pipeline result (artifacts, errors, status, perspective, etc.) */
  output: string;
  /** Structured metadata for the eval runner */
  metadata?: Record<string, unknown>;
}

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
        origin: "uploaded",
        mimeType: "application/pdf",
        checksum: "",
        storageUrl: storageKey,
        parseStatus: "pending",
      });
    } catch {
      console.warn(`  ⚠ PDF not found: ${pdfPath}`);
    }
  }

  return { input, sources };
}

/**
 * Run the research init pipeline for a given fixture.
 *
 * @param input - The fixture ID (e.g. "ai-model-collapse")
 * @param context - Test case context with expected_signals, etc.
 * @param tracer - Tracer instance for capturing trajectory
 * @param _sandboxDir - Unused (pipeline uses in-memory storage)
 */
export async function runAgent(
  input: string,
  context?: Record<string, unknown>,
  tracer?: Tracer,
  _sandboxDir?: string
): Promise<AgentResult> {
  const fixtureId = input;
  const { input: userInput, sources } = await loadFixture(fixtureId);

  const projectId = generateId();
  const runId = generateId();
  const config = { configurable: { thread_id: runId } };

  // Reset cost tracker for this run
  costTracker.reset();

  // Phase 1: Run graph until interrupt at confirm_inferred_brief
  const phase1Start = Date.now();

  const phase1Result = await initGraph.invoke(
    {
      projectId,
      runId,
      userId: "eval-runner",
      status: "queued" as const,
      input: userInput,
      sources,
    },
    config
  );

  const phase1Duration = Date.now() - phase1Start;
  tracer?.traceNodeTransition("intake_user_context → infer_user_perspective → confirm_inferred_brief (interrupt)", phase1Duration);

  if (phase1Result.perspective) {
    tracer?.traceLlmCall(
      "google/gemini-3-flash-preview",
      0, 0, // Tokens captured at LLM level, not here
      phase1Duration
    );
  }

  // Phase 2: Accept the brief and run the rest of the pipeline
  const phase2Start = Date.now();

  const finalResult = await initGraph.invoke(
    new Command({ resume: { action: "accept" } }),
    config
  );

  const phase2Duration = Date.now() - phase2Start;
  tracer?.traceNodeTransition("build_source_set → analyze_evidence → consolidate → synthesize → persist", phase2Duration);

  // Collect metrics
  const totalDuration = phase1Duration + phase2Duration;
  const parsedSourceCount = finalResult.parsedSources?.length ?? 0;
  const discoveredSourceCount = (finalResult.sources ?? []).filter(
    (s: SourceEntry) => s.origin === "discovered"
  ).length;
  const uploadedSourceCount = (finalResult.sources ?? []).filter(
    (s: SourceEntry) => s.origin === "uploaded"
  ).length;

  // Build the output JSON — this is what graders will evaluate
  const outputData = {
    status: finalResult.status,
    perspective: finalResult.perspective,
    artifacts: finalResult.artifacts,
    errors: finalResult.errors ?? [],
    sourceStats: {
      total: (finalResult.sources ?? []).length,
      uploaded: uploadedSourceCount,
      discovered: discoveredSourceCount,
      parsed: parsedSourceCount,
    },
  };

  // Capture cost data
  const costs = costTracker.snapshot();

  return {
    output: JSON.stringify(outputData, null, 2),
    metadata: {
      projectId,
      runId,
      fixtureId,
      totalDurationMs: totalDuration,
      phase1DurationMs: phase1Duration,
      phase2DurationMs: phase2Duration,
      parsedSourceCount,
      discoveredSourceCount,
      uploadedSourceCount,
      status: finalResult.status,
      hasArtifacts: !!finalResult.artifacts,
      errorCount: (finalResult.errors ?? []).length,
      costs,
    },
  };
}
