import type { InitRunState, InitRunUpdate } from "../state";
import { classifySourceFolders } from "./classify-source-folders";
import { analyzeEvidence } from "./analyze-evidence";

/**
 * Composite node that runs classify_source_folders and analyze_evidence in parallel.
 * Both only depend on parsedSources + perspective from build_source_set — neither
 * depends on the other's output.
 */
export async function classifyAndAnalyze(
  state: InitRunState
): Promise<InitRunUpdate> {
  const [classifyResult, analyzeResult] = await Promise.all([
    classifySourceFolders(state),
    analyzeEvidence(state),
  ]);

  return { ...classifyResult, ...analyzeResult };
}
