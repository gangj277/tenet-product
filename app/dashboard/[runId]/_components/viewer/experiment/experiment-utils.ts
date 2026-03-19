import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import { isExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";

export function parseExperimentDesignContent(
  content: string
): ExperimentDesign | null {
  try {
    const parsed = JSON.parse(content);
    return isExperimentDesign(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function cloneExperimentDesign(
  design: ExperimentDesign
): ExperimentDesign {
  return structuredClone(design);
}
