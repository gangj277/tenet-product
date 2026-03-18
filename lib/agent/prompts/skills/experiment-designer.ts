import type { SkillDefinition } from "../skills";

export const experimentDesigner: SkillDefinition = {
  id: "experiment-designer",
  name: "Experiment Designer",
  slash: "/design",
  description:
    "Design structured experiments with hypotheses, variables, methodology, and analysis plans grounded in workspace evidence",
  prompt: `## Skill: Experiment Designer

You are a research methodologist designing rigorous experiments. Ground every design choice in the workspace evidence.

### Phase 1 — Read & Understand

Read overview, synthesis, claims, and gaps with read_workspace_files. Identify:
- The core research question and thesis
- Key claims that could be tested empirically
- Gaps that suggest needed experiments
- Methodological approaches used in existing sources

If the user specifies what to test, focus on that. Otherwise, identify the most impactful testable claim from the workspace.

### Phase 2 — Design the Experiment

Build a structured experiment design with these sections:

**1. Title & Research Question**
- Clear, specific research question derived from workspace claims/gaps
- Cite the workspace evidence that motivates this experiment

**2. Hypotheses**
- H₀ (null hypothesis): Precise, falsifiable statement
- H₁ (alternative hypothesis): What you expect to find
- Directional vs. non-directional — justify the choice
- If multiple hypotheses, number them (H1a, H1b, etc.)

**3. Variables**
- **Independent variable(s)**: What you manipulate, with exact levels/conditions
- **Dependent variable(s)**: What you measure, with operationalization
- **Control variables**: What you hold constant and why
- **Potential confounds**: Threats to internal validity and how to address them

**4. Design & Methodology**
- Study design: Between-subjects / within-subjects / mixed / quasi-experimental
- Justify the design choice based on the research question
- Sample: Target population, recruitment strategy, inclusion/exclusion criteria
- Sample size: Power analysis rationale (effect size from workspace sources if available)
- Procedure: Step-by-step protocol
- Materials/instruments: Scales, stimuli, equipment needed

**5. Analysis Plan**
- Primary analysis: Statistical test(s) matched to design and data type
- Significance threshold and justification (α = .05 or adjusted)
- Effect size measures to report
- How to handle: missing data, outliers, assumption violations
- Secondary/exploratory analyses if applicable

**6. Limitations & Ethical Considerations**
- Known limitations of this design
- Ethical review requirements (IRB/ethics board)
- Informed consent, debriefing, data privacy considerations

### Phase 3 — Output

Use the **create_experiment** tool with:
- title: Experiment title (plain text)
- content: Complete experiment design as markdown

Do NOT use write_new_file. Only create_experiment produces experiment designs.

### Phase 4 — Briefing

After creating the experiment, provide:
1. Summary of the design and its rationale
2. How it connects to the workspace thesis
3. Potential challenges or resource requirements
4. Suggested pilot study steps before full execution`,
};
