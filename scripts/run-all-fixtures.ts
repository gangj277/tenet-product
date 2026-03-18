/**
 * Run all 3 fixtures end-to-end.
 *
 * Usage: npx tsx scripts/run-all-fixtures.ts
 */
import { readFile } from "fs/promises";
import { resolve } from "path";
import { initGraph } from "../lib/engine/graph";
import { generateId } from "../lib/utils/id";
import { memoryStore } from "../lib/storage/memory-store";
import { Command } from "@langchain/langgraph";
import type { UserInput, SourceEntry } from "../lib/engine/state";

const ROOT = resolve(__dirname, "../../fixtures/project-init");
const MANIFEST_PATH = resolve(ROOT, "manifest.json");

interface ManifestDataset {
  id: string;
  title: string;
  path: string;
  pdfCount: number;
}

interface FixtureSource {
  filename: string;
  title: string;
  pdfUrl: string;
}

async function runFixture(dataset: ManifestDataset) {
  const dir = resolve(ROOT, dataset.id);
  const input: UserInput = JSON.parse(
    await readFile(resolve(dir, "input.json"), "utf-8")
  );
  const sourceDefs: FixtureSource[] = JSON.parse(
    await readFile(resolve(dir, "sources.json"), "utf-8")
  );

  // Load uploaded sources
  const sources: SourceEntry[] = [];
  for (const s of sourceDefs) {
    const pdfPath = resolve(dir, "pdfs", s.filename);
    try {
      const buffer = await readFile(pdfPath);
      const sourceId = generateId();
      const storageKey = `fixture/${dataset.id}/${s.filename}`;
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
      // Skip missing PDFs
    }
  }

  const projectId = generateId();
  const runId = generateId();
  const config = { configurable: { thread_id: runId } };
  const startTime = Date.now();

  // Phase 1: Run to interrupt
  await initGraph.invoke(
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

  // Phase 2: Accept and run to completion
  const result = await initGraph.invoke(
    new Command({ resume: { action: "accept" } }),
    config
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    id: dataset.id,
    title: dataset.title,
    status: result.status,
    elapsed,
    hasOverview: !!result.artifacts?.overview,
    hasSynthesis: !!result.artifacts?.synthesis,
    hasClaims: !!result.artifacts?.claims,
    hasGaps: !!result.artifacts?.gaps,
    hasNextSteps: !!result.artifacts?.nextSteps,
    sourceCount: Object.keys(result.artifacts?.sources ?? {}).length,
    errorCount: result.errors?.length ?? 0,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
  const datasets: ManifestDataset[] = manifest.datasets;

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   Running all ${datasets.length} fixtures                ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  const results = [];

  for (const dataset of datasets) {
    console.log(`▸ ${dataset.title}`);
    try {
      const result = await runFixture(dataset);
      results.push(result);
      const status = result.status === "completed" ? "✓" : "⚠";
      console.log(`  ${status} ${result.status} in ${result.elapsed}s`);
    } catch (err) {
      console.log(`  ✗ FATAL: ${(err as Error).message}`);
      results.push({
        id: dataset.id,
        title: dataset.title,
        status: "fatal_error",
        elapsed: "0",
        hasOverview: false,
        hasSynthesis: false,
        hasClaims: false,
        hasGaps: false,
        hasNextSteps: false,
        sourceCount: 0,
        errorCount: 1,
      });
    }
  }

  // Summary table
  console.log(`\n╔═══════════════════════════════════════════════════════════════════╗`);
  console.log(`║   Summary                                                       ║`);
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(
    `║ ${"Fixture".padEnd(30)} ${"Status".padEnd(12)} ${"Time".padEnd(8)} ${"Artifacts".padEnd(10)} ║`
  );
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

  for (const r of results) {
    const arts = [
      r.hasOverview,
      r.hasSynthesis,
      r.hasClaims,
      r.hasGaps,
      r.hasNextSteps,
    ].filter(Boolean).length;
    console.log(
      `║ ${r.id.padEnd(30)} ${r.status.padEnd(12)} ${(r.elapsed + "s").padEnd(8)} ${arts}/5       ║`
    );
  }

  console.log(`╚═══════════════════════════════════════════════════════════════════╝\n`);

  const allPassed = results.every((r) => r.status === "completed");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
