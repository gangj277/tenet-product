import { SKILL_MAP, SKILLS } from "../prompts/skills";

/**
 * Load a skill by ID. Returns the skill's full prompt text
 * to be injected into the agent's context for the current turn.
 */
export function executeLoadSkill(
  args: { skill_id: string }
): { result: string; skillId: string | null } {
  const skill = SKILL_MAP.get(args.skill_id);

  if (!skill) {
    const available = SKILLS.map((s) => `"${s.id}"`).join(", ");
    return {
      result: `Unknown skill "${args.skill_id}". Available skills: ${available}`,
      skillId: null,
    };
  }

  return {
    result: `Skill "${skill.name}" loaded.\n\n${skill.prompt}`,
    skillId: skill.id,
  };
}
