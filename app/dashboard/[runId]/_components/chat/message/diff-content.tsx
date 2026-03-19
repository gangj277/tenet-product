import { ExperimentDiffView, LineDiffView } from "../../diff";
import { parseExperimentDiff } from "./message-utils";

export function DiffContent({
  oldContent,
  newContent,
  isExperiment,
}: {
  oldContent: string;
  newContent: string;
  isExperiment: boolean;
}) {
  if (isExperiment) {
    const parsed = parseExperimentDiff(oldContent, newContent);
    if (parsed) {
      return (
        <ExperimentDiffView
          oldDesign={parsed.oldDesign}
          newDesign={parsed.newDesign}
        />
      );
    }
  }

  return <LineDiffView oldText={oldContent} newText={newContent} />;
}
