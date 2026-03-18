import { interrupt } from "@langchain/langgraph";
import type { InitRunState, InitRunUpdate, Perspective } from "../state";

export async function confirmInferredBrief(
  state: InitRunState
): Promise<InitRunUpdate> {
  // Pause execution — surface the inferred brief to the user
  const userDecision = interrupt({
    type: "confirm_brief",
    perspective: state.perspective,
    message:
      "Please review the inferred research brief. You can accept or edit it.",
  }) as { action: "accept" | "edit"; perspective?: Perspective };

  if (userDecision.action === "edit" && userDecision.perspective) {
    return {
      perspective: userDecision.perspective,
      currentStep: "confirm_inferred_brief",
    };
  }

  // Accept — no state change needed
  return {
    currentStep: "confirm_inferred_brief",
  };
}
