/**
 * Typed schema for structured experiment designs.
 * Stored as JSON in the experiments.content column.
 * Rendered by ExperimentViewer on the frontend.
 */
export interface ExperimentDesign {
  version: 1;
  title: string;

  researchQuestion: string;
  motivation: string;

  hypotheses: Array<{
    id: string;
    type: "null" | "alternative";
    statement: string;
  }>;

  variables: {
    independent: Array<{
      name: string;
      description: string;
      levels: string[];
    }>;
    dependent: Array<{
      name: string;
      measure: string;
      instrument?: string;
    }>;
    controls: Array<{
      name: string;
      rationale: string;
    }>;
  };

  design: {
    type: string;
    justification: string;
  };

  sample: {
    population: string;
    targetN: number;
    powerRationale: string;
    recruitment: string;
  };

  procedure: string[];

  analysis: {
    primaryTest: string;
    alpha: string;
    effectSizeMeasure: string;
    missingDataStrategy: string;
    secondaryAnalyses?: string[];
  };

  limitations: string[];

  ethics: string;
}

/**
 * Type guard: checks if parsed JSON is a valid ExperimentDesign.
 * Resilient to LLMs occasionally omitting the `version` field —
 * detects based on the presence of core structural fields.
 */
export function isExperimentDesign(obj: unknown): obj is ExperimentDesign {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.researchQuestion === "string" &&
    typeof o.title === "string" &&
    Array.isArray(o.hypotheses) &&
    Array.isArray(o.procedure) &&
    typeof o.variables === "object" &&
    o.variables !== null
  );
}
