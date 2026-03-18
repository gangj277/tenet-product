/**
 * Run a single fixture end-to-end through the init pipeline.
 *
 * Usage: npx tsx scripts/run-fixture.ts <fixture-id>
 * Example: npx tsx scripts/run-fixture.ts ai-model-collapse
 */
import { readFile } from "fs/promises";
import { resolve } from "path";
import { initGraph } from "../lib/engine/graph";
import { generateId } from "../lib/utils/id";
import { memoryStore } from "../lib/storage/memory-store";
import { Command } from "@langchain/langgraph";
import type { UserInput, SourceEntry } from "../lib/engine/state";

const ROOT = resolve(__dirname, "../../fixtures/project-init");

interface FixtureSource {
  filename: string;
  title: string;
  year: number;
  sourceType: string;
  landingUrl: string;
  pdfUrl: string;
}

async function loadFixture(fixtureId: string) {
  const dir = resolve(ROOT, fixtureId);
  const input: UserInput = JSON.parse(
    await readFile(resolve(dir, "input.json"), "utf-8")
  );
  const sourceDefs: FixtureSource[] = JSON.parse(
    await readFile(resolve(dir, "sources.json"), "utf-8")
  );

  // Register uploaded sources from fixture PDFs
  const sources: SourceEntry[] = [];
  for (const s of sourceDefs) {
    const pdfPath = resolve(dir, "pdfs", s.filename);
    try {
      const buffer = await readFile(pdfPath);
      const sourceId = generateId();
      const storageKey = `fixture/${fixtureId}/${s.filename}`;
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
      console.warn(`  ⚠ PDF not found: ${pdfPath}, skipping`);
    }
  }

  return { input, sources };
}

async function run(fixtureId: string) {
  console.log(`\n━━━ Running fixture: ${fixtureId} ━━━\n`);

  const { input, sources } = await loadFixture(fixtureId);
  const projectId = generateId();
  const runId = generateId();
  const config = { configurable: { thread_id: runId } };

  console.log(`Project: ${projectId}`);
  console.log(`Run:     ${runId}`);
  console.log(`Question: ${input.researchQuestion}`);
  console.log(`Sources:  ${sources.length} uploaded PDFs`);

  // Phase 1: Run until interrupt (intake → infer → confirm_brief pauses)
  console.log(`\n── Phase 1: Running to brief confirmation ──`);
  const startTime = Date.now();

  const phase1Result = await initGraph.invoke(
    {
      projectId,
      runId,
      userId: "fixture-runner",
      status: "queued" as const,
      input,
      sources,
    },
    config
  );

  const phase1Time = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Done in ${phase1Time}s`);

  if (phase1Result.perspective) {
    console.log(`\n  Inferred perspective:`);
    console.log(`    Brief: ${phase1Result.perspective.briefSummary}`);
    console.log(`    Frame: ${phase1Result.perspective.inferredResearchFrame}`);
    console.log(
      `    Subquestions: ${phase1Result.perspective.subquestions?.length ?? 0}`
    );
  } else {
    console.log(`  ⚠ No perspective inferred`);
    if (phase1Result.errors?.length) {
      console.log(`  Errors:`, phase1Result.errors);
    }
    return phase1Result;
  }

  // Phase 2: Accept brief and run rest of pipeline
  console.log(`\n── Phase 2: Accepting brief, running full pipeline ──`);
  const phase2Start = Date.now();

  const finalResult = await initGraph.invoke(
    new Command({ resume: { action: "accept" } }),
    config
  );

  const phase2Time = ((Date.now() - phase2Start) / 1000).toFixed(1);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Done in ${phase2Time}s (total: ${totalTime}s)`);

  // Report results
  console.log(`\n── Results ──`);
  console.log(`  Status: ${finalResult.status}`);
  console.log(`  Errors: ${finalResult.errors?.length ?? 0}`);

  if (finalResult.artifacts) {
    const a = finalResult.artifacts;
    console.log(`\n  Artifacts:`);
    console.log(
      `    overview.md:    ${a.overview ? `${a.overview.length} chars` : "MISSING"}`
    );
    console.log(
      `    synthesis.md:   ${a.synthesis ? `${a.synthesis.length} chars` : "MISSING"}`
    );
    console.log(
      `    claims.md:      ${a.claims ? `${a.claims.length} chars` : "MISSING"}`
    );
    console.log(
      `    gaps.md:        ${a.gaps ? `${a.gaps.length} chars` : "MISSING"}`
    );
    console.log(
      `    nextSteps.md:   ${a.nextSteps ? `${a.nextSteps.length} chars` : "MISSING"}`
    );
    console.log(
      `    source files:   ${Object.keys(a.sources ?? {}).length}`
    );

    // Write artifacts to stdout-friendly format
    console.log(`\n── synthesis.md (first 500 chars) ──`);
    console.log(a.synthesis?.slice(0, 500) ?? "(empty)");
  } else {
    console.log(`  ⚠ No artifacts generated`);
  }

  if (finalResult.errors?.length) {
    console.log(`\n  Errors encountered:`);
    for (const e of finalResult.errors) {
      console.log(`    [${e.step}] ${e.message}`);
    }
  }

  console.log(`\n━━━ Fixture ${fixtureId} complete ━━━\n`);
  return finalResult;
}

// Main
const fixtureId = process.argv[2];
if (!fixtureId) {
  console.error("Usage: npx tsx scripts/run-fixture.ts <fixture-id>");
  console.error("Available: ai-model-collapse, operations-research-routing, medical-glp1-obesity");
  process.exit(1);
}

run(fixtureId).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
