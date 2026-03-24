export type DashboardNewPhase =
  | "form"
  | "submitting"
  | "review"
  | "processing";

export function requireSelectedWorkspacePath({
  isElectron,
  workspacePath,
}: {
  isElectron: boolean;
  workspacePath: string | null;
}): string | undefined {
  if (!isElectron) {
    return undefined;
  }

  const normalized = workspacePath?.trim();
  if (!normalized) {
    throw new Error("Choose a workspace folder before starting.");
  }

  return normalized;
}

export function canStartResearch({
  question,
  isElectron,
  workspacePath,
  phase,
  creatingBlankWorkspace,
}: {
  question: string;
  isElectron: boolean;
  workspacePath: string | null;
  phase: DashboardNewPhase;
  creatingBlankWorkspace: boolean;
}): boolean {
  if (!question.trim()) {
    return false;
  }

  if (phase === "submitting" || creatingBlankWorkspace) {
    return false;
  }

  return !isElectron || !!workspacePath?.trim();
}

export function canStartBlankWorkspace({
  isElectron,
  workspacePath,
  phase,
  creatingBlankWorkspace,
}: {
  isElectron: boolean;
  workspacePath: string | null;
  phase: DashboardNewPhase;
  creatingBlankWorkspace: boolean;
}): boolean {
  if (phase === "submitting" || creatingBlankWorkspace) {
    return false;
  }

  return !isElectron || !!workspacePath?.trim();
}
