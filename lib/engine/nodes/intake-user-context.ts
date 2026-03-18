import type { InitRunState, InitRunUpdate } from "../state";

export async function intakeUserContext(
  state: InitRunState
): Promise<InitRunUpdate> {
  if (!state.input?.researchQuestion?.trim()) {
    return {
      status: "failed",
      errors: [
        {
          step: "intake_user_context",
          message: "Research question is required",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  return {
    status: "running",
    currentStep: "intake_user_context",
    startedAt: new Date().toISOString(),
  };
}
