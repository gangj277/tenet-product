/**
 * Client-safe skill definitions for the slash command picker.
 * Mirrors the server-side SKILLS but without the full prompt text.
 */

export interface SkillInfo {
  id: string;
  name: string;
  slash: string;
  description: string;
}

export const SKILL_LIST: SkillInfo[] = [
  {
    id: "compact-context",
    name: "Compact Context",
    slash: "/compact",
    description: "Shrink the saved chat context so the agent can keep working",
  },
  {
    id: "devils-advocate",
    name: "Devil's Advocate",
    slash: "/challenge",
    description: "Challenge claims and find counter-arguments",
  },
  {
    id: "source-scout",
    name: "Source Scout",
    slash: "/scout",
    description: "Find citation gaps and discover new sources",
  },
  {
    id: "paper-explainer",
    name: "Paper Explainer",
    slash: "/explain",
    description: "Explain papers, concepts, and methods",
  },
  {
    id: "evidence-adjudicator",
    name: "Evidence Adjudicator",
    slash: "/weigh",
    description: "Weigh conflicting evidence and assess quality",
  },
  {
    id: "synthesis-updater",
    name: "Synthesis Updater",
    slash: "/update",
    description: "Propose structured updates to workspace files",
  },
  {
    id: "draft-paper",
    name: "Paper Drafter",
    slash: "/draft",
    description: "Draft a LaTeX paper from workspace research",
  },
  {
    id: "methodology-critic",
    name: "Methodology Critic",
    slash: "/critique",
    description: "Critique study design and flag overclaims",
  },
  {
    id: "experiment-designer",
    name: "Experiment Designer",
    slash: "/design",
    description: "Design structured experiments with hypotheses and methodology",
  },
];
