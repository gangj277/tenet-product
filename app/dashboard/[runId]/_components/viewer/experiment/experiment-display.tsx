"use client";

import type { LineRange, SourceRef } from "../../../../_lib/citation-utils";
import type { ExperimentDesign } from "@/lib/agent/tools/experiment-design-schema";
import { ExperimentHeader } from "./sections/experiment-header";
import { ExperimentHypotheses } from "./sections/experiment-hypotheses";
import { ExperimentVariables } from "./sections/experiment-variables";
import { ExperimentDesignSample } from "./sections/experiment-design-sample";
import { ExperimentAnalysis } from "./sections/experiment-analysis";

export interface ExperimentSectionProps {
  design: ExperimentDesign;
  editing: boolean;
  updateDraft: (updater: (prev: ExperimentDesign) => ExperimentDesign) => void;
  sourceFiles?: SourceRef[];
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
}

export function ExperimentDisplay({
  design,
  editing,
  updateDraft,
  sourceFiles,
  onNavigateSource,
}: {
  design: ExperimentDesign;
  editing: boolean;
  updateDraft: (updater: (draft: ExperimentDesign) => ExperimentDesign) => void;
  sourceFiles?: SourceRef[];
  onNavigateSource?: (sourceKey: string, lineRange?: LineRange) => void;
}) {
  const sectionProps: ExperimentSectionProps = {
    design,
    editing,
    updateDraft,
    sourceFiles,
    onNavigateSource,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[740px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        <ExperimentHeader {...sectionProps} />
        <ExperimentHypotheses {...sectionProps} />
        <ExperimentVariables {...sectionProps} />
        <ExperimentDesignSample {...sectionProps} />
        <ExperimentAnalysis {...sectionProps} />
      </div>
    </div>
  );
}
