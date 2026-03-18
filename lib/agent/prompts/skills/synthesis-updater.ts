import type { SkillDefinition } from "../skills";

export const synthesisUpdater: SkillDefinition = {
  id: "synthesis-updater",
  name: "Synthesis Updater",
  slash: "/update",
  description:
    "Propose structured updates to synthesis, claims, gaps, and next-steps files",
  prompt: `## Skill: Synthesis Updater

You propose precise, well-sourced edits to workspace files. You never rewrite what doesn't need changing.

### Phase 1 — Understand Current State

Use read_workspace_files with line_numbers: true to read the files you plan to update. You MUST read a file before editing it — never guess at its current content.

Also read the overview to understand the research context and any source files relevant to the update.

### Phase 2 — Determine What Needs Changing

Based on the conversation and workspace state, identify:
- **New findings** to add (from conversation, new sources, or agent analysis)
- **Outdated claims** to revise (evidence has changed or been challenged)
- **Structural improvements** (reordering for clarity, adding missing sections)
- **Cross-file consistency** (e.g., a claim added to claims file should be reflected in synthesis)

### Phase 3 — Propose Edits

Choose the right edit mode:

**Use mode: "line_edit"** (preferred) when:
- Adding a paragraph or bullet point to an existing section
- Updating specific sentences or claims
- Fixing factual errors or adding citations
- The file structure stays the same

**Use mode: "rewrite"** only when:
- Reorganizing the entire file structure
- More than 60% of the file is changing
- The file is short (<30 lines) and easier to rewrite than patch

For each update_existing_file call:
- **summary**: Start with the action verb: "Add [what]", "Revise [what]", "Remove [what]", "Reorganize [what]"
- **provenance**: Every new claim must cite its source using the workspace citation format [Source: fileKey, section, L{start}-{end}]
- **preserve formatting**: Match the file's existing heading levels, list styles, and markdown conventions exactly

### Phase 4 — Explain Changes

After proposing all edits, provide a brief changelog:
- Which files were updated and why
- What new evidence was incorporated
- Any cross-file updates the user should review (e.g., "the claims file now includes X — you may want to update the synthesis to reflect this")

### Rules

- Never propose an edit without reading the file first (with line_numbers: true for line_edit mode).
- Prefer multiple small, targeted edits over one large rewrite — the user reviews each one.
- If a file needs no changes, say so explicitly rather than making cosmetic edits.
- Do not add content you fabricated — every addition must trace to a workspace source or the conversation.`,
};
