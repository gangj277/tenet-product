/** Skill definitions — cognitive overlays loaded on-demand via load_skill tool or user /command */

import { devilsAdvocate } from "./skills/devils-advocate";
import { sourceScout } from "./skills/source-scout";
import { paperExplainer } from "./skills/paper-explainer";
import { evidenceAdjudicator } from "./skills/evidence-adjudicator";
import { synthesisUpdater } from "./skills/synthesis-updater";
import { draftPaper } from "./skills/draft-paper";
import { methodologyCritic } from "./skills/methodology-critic";
import { experimentDesigner } from "./skills/experiment-designer";

export interface SkillDefinition {
  id: string;
  name: string;
  slash: string;
  description: string;
  prompt: string;
}

export const SKILLS: SkillDefinition[] = [
  devilsAdvocate,
  sourceScout,
  paperExplainer,
  evidenceAdjudicator,
  synthesisUpdater,
  draftPaper,
  methodologyCritic,
  experimentDesigner,
];

/** Map from skill ID to definition for quick lookup */
export const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

/** Lookup by slash command */
export const SKILL_BY_SLASH = new Map(SKILLS.map((s) => [s.slash, s]));

/** Minimal skill info for the frontend (no prompt text) */
export type SkillInfo = Pick<SkillDefinition, "id" | "name" | "slash" | "description">;

export const SKILL_LIST: SkillInfo[] = SKILLS.map(({ id, name, slash, description }) => ({
  id,
  name,
  slash,
  description,
}));
