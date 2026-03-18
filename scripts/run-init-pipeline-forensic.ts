import { mkdir, writeFile } from "fs/promises";
import path from "node:path";

import { runForensicInitPipeline } from "../tests/helpers/init-pipeline-forensic";

async function main() {
  const report = await runForensicInitPipeline();
  const outputPath = resolveOutputPath(process.argv.slice(2));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Forensic init pipeline report written to ${outputPath}`);
  console.log(`Pipeline status: ${report.finalStatus.status}`);
  console.log(`Parsed sources: ${report.finalState.parsedSourceCount}`);
  console.log(`Source chunks: ${report.finalState.sourceChunkCount}`);
  console.log(`Invariant failures: ${report.invariants.failed.length}`);

  if (report.invariants.failed.length > 0) {
    for (const failure of report.invariants.failed) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

function resolveOutputPath(args: string[]) {
  const outputFlag = args.find((value) => value.startsWith("--output="));
  if (outputFlag) {
    return path.resolve(process.cwd(), outputFlag.slice("--output=".length));
  }

  return path.resolve(
    process.cwd(),
    "artifacts/forensics/init-pipeline-report.json"
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
