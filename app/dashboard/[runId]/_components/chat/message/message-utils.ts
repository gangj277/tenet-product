import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import { isExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";

export function formatCitations(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function parseExperimentDiff(
  oldContent: string,
  newContent: string
): { oldDesign: ExperimentDesign; newDesign: ExperimentDesign } | null {
  try {
    const oldDesign = JSON.parse(oldContent);
    const newDesign = JSON.parse(newContent);

    if (isExperimentDesign(oldDesign) && isExperimentDesign(newDesign)) {
      return { oldDesign, newDesign };
    }
  } catch {
    return null;
  }

  return null;
}
