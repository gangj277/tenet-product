import type { FileMeta, WorkspaceContext } from "../state";
import { SKILLS, type SkillDefinition } from "./skills";

/** Max files to show per source folder/group before truncating */
const MAX_FILES_PER_GROUP = 5;

function expandFolderPath(folderPath: string): string[] {
  const segments = folderPath.split("/").map((segment) => segment.trim()).filter(Boolean);
  const expanded: string[] = [];
  let current = "";

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    expanded.push(current);
  }

  return expanded;
}

function collectFolderPaths(ctx: WorkspaceContext): string[] {
  const seen = new Set<string>();

  for (const path of ctx.folderPaths ?? []) {
    for (const expanded of expandFolderPath(path)) {
      seen.add(expanded);
    }
  }

  for (const key of ctx.availableKeys) {
    const folder = ctx.fileMeta?.[key]?.folder;
    if (!folder) continue;
    for (const expanded of expandFolderPath(folder)) {
      seen.add(expanded);
    }
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Build a structured workspace map grouped by file type.
 * Produces a compact overview the agent can scan to understand the terrain.
 */
function buildWorkspaceMap(ctx: WorkspaceContext): string {
  const meta = ctx.fileMeta ?? {};
  const labels = ctx.fileLabels ?? {};

  // Partition keys by group
  const core: string[] = [];
  const notes: string[] = [];
  const papers: string[] = [];
  const experiments: string[] = [];
  const sources: string[] = [];

  for (const key of ctx.availableKeys) {
    const m = meta[key];
    const group = m?.group ?? inferGroup(key);
    switch (group) {
      case "core": core.push(key); break;
      case "note": notes.push(key); break;
      case "paper": papers.push(key); break;
      case "experiment": experiments.push(key); break;
      case "source": sources.push(key); break;
    }
  }

  const sections: string[] = [];

  // ── Artifacts ──
  if (core.length > 0) {
    const lines = core.map((k) => `  - "${k}" — ${labels[k] ?? k}`);
    sections.push(`### Artifacts (${core.length})\n${lines.join("\n")}`);
  }

  // ── Notes ──
  if (notes.length > 0) {
    const lines = notes.map((k) => `  - "${k}" — ${labels[k] ?? k}`);
    sections.push(`### Notes (${notes.length})\n${lines.join("\n")}`);
  }

  // ── Papers ──
  if (papers.length > 0) {
    const lines = papers.map((k) => `  - "${k}" — ${labels[k] ?? k}`);
    sections.push(`### Papers (${papers.length})\n${lines.join("\n")}`);
  }

  // ── Experiments ──
  if (experiments.length > 0) {
    const lines = experiments.map((k) => `  - "${k}" — ${labels[k] ?? k}`);
    sections.push(`### Experiments (${experiments.length})\n${lines.join("\n")}`);
  }

  // ── Sources (grouped by origin + folder) ──
  if (sources.length > 0) {
    sections.push(buildSourcesSection(sources, meta, labels));
  }

  const folderPaths = collectFolderPaths(ctx);
  if (folderPaths.length > 0) {
    sections.push(buildFoldersSection(folderPaths, ctx, labels));
  }

  return sections.join("\n\n");
}

/**
 * Build the Sources section with folder grouping and truncation.
 */
function buildSourcesSection(
  sources: string[],
  meta: Record<string, FileMeta>,
  labels: Record<string, string>
): string {
  // Split by origin
  const uploaded: string[] = [];
  const discoveredByFolder = new Map<string, string[]>();
  const discoveredUngrouped: string[] = [];

  for (const key of sources) {
    const m = meta[key];
    if (m?.origin === "discovered") {
      if (m.folder) {
        const arr = discoveredByFolder.get(m.folder) ?? [];
        arr.push(key);
        discoveredByFolder.set(m.folder, arr);
      } else {
        discoveredUngrouped.push(key);
      }
    } else {
      uploaded.push(key);
    }
  }

  const parts: string[] = [`### Sources (${sources.length})`];

  // Uploaded
  if (uploaded.length > 0) {
    parts.push(`  **Uploaded** (${uploaded.length}):`);
    parts.push(...formatFileGroup(uploaded, labels, MAX_FILES_PER_GROUP, 4));
  }

  // Discovered — by folder
  for (const [folder, keys] of Array.from(discoveredByFolder.entries())) {
    parts.push(`  **${folder}** (${keys.length}):`);
    parts.push(...formatFileGroup(keys, labels, MAX_FILES_PER_GROUP, 4));
  }

  // Discovered — ungrouped
  if (discoveredUngrouped.length > 0) {
    parts.push(`  **Discovered** (${discoveredUngrouped.length}):`);
    parts.push(...formatFileGroup(discoveredUngrouped, labels, MAX_FILES_PER_GROUP, 4));
  }

  // Hint for large source collections
  if (sources.length > 10) {
    parts.push(`  _Use search_workspace to find sources by topic._`);
  }

  return parts.join("\n");
}

/** Format a group of files with optional truncation */
function formatFileGroup(
  keys: string[],
  labels: Record<string, string>,
  max: number,
  indent: number
): string[] {
  const pad = " ".repeat(indent);
  const shown = keys.slice(0, max);
  const lines = shown.map((k) => `${pad}- "${k}" — ${labels[k] ?? k}`);
  const remaining = keys.length - shown.length;
  if (remaining > 0) {
    lines.push(`${pad}  ... +${remaining} more`);
  }
  return lines;
}

function buildFoldersSection(
  folderPaths: string[],
  ctx: WorkspaceContext,
  labels: Record<string, string>
): string {
  const parts: string[] = [`### Folders (${folderPaths.length})`];

  for (const folder of folderPaths) {
    const keys = ctx.availableKeys.filter((key) => {
      const keyFolder = ctx.fileMeta?.[key]?.folder;
      return keyFolder === folder || keyFolder?.startsWith(`${folder}/`);
    });

    parts.push(`  - "${folder}" (${keys.length} file${keys.length === 1 ? "" : "s"})`);
    if (keys.length > 0) {
      parts.push(...formatFileGroup(keys, labels, MAX_FILES_PER_GROUP, 4));
    }
  }

  return parts.join("\n");
}

/** Fallback group inference from key prefix when fileMeta is missing */
function inferGroup(key: string): FileMeta["group"] {
  if (key.startsWith("source:")) return "source";
  if (key.startsWith("paper:")) return "paper";
  if (key.startsWith("note:")) return "note";
  if (key.startsWith("experiment:")) return "experiment";
  return "core";
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt Composition: Infrastructure + Default Directive + Active Skills
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the infrastructure layer — stable context always present in the system prompt.
 * Contains: workspace map, tool descriptions, citation format, update rules, @mention handling.
 */
export function buildInfrastructure(ctx: WorkspaceContext): string {
  const workspaceMap = buildWorkspaceMap(ctx);

  return `## Workspace Structure

${workspaceMap}

## Tools

- **search_workspace**: Search across all workspace files for one or more terms (OR logic). Returns matching lines with context. Use this first to locate topics, then follow up with read_workspace_files.
- **read_workspace_files**: Read one or more workspace files by key. Always read a file before editing it.
- **update_existing_file**: Propose an edit to an existing file. Two modes:
  - \`"rewrite"\`: Replace entire file content. Use for large restructuring or when >60% of content changes.
  - \`"targeted"\` (recommended): Surgical string-match edits. Each edit specifies \`old_str\` (exact text to find) and \`new_str\` (replacement). The old_str must uniquely match one location in the file — include 1-3 lines of surrounding context to ensure uniqueness. Edits apply sequentially, so each subsequent edit matches against the result of prior edits.
  User reviews before accepting.
- **write_new_file**: Propose a new file. Use \`note:<id>\` keys for user-visible markdown notes in the Artifacts sidebar. Pass \`folder\` when the user wants the note placed inside a specific folder. User reviews before accepting.
- **create_paper**: Create a new LaTeX paper. Uses \`paper:<uuid>\` keys. Editable later with update_existing_file.
- **create_experiment**: Create a new experiment design. Uses \`experiment:<uuid>\` keys. Editable later with update_existing_file.
- **search_external_sources**: Search for external academic sources. Default returns metadata only. Pass \`extraction_goal\` for deep search — fetches full content, extracts findings, and auto-adds sources to workspace as \`source:<uuid>\` keys. Deep search takes 1-3 minutes.
- **load_skill**: Load a specialized analytical skill for deeper, structured analysis.
- **read_skill_reference**: Read deep reference material from an active skill's library (only available when a skill with references is loaded).
- **plan_tasks**: Decompose a complex request into 2-8 ordered tasks before starting work. Each task has a single verifiable objective. Use when the request requires analyzing 3+ files, multiple dependent claims, or sequential analysis steps.
- **complete_task**: Mark the active task as completed with a 2-4 sentence result summary. The result is compacted context for downstream tasks — state findings, not process.

## Citation Format

When referencing workspace content, use: \`[Source: fileKey, section]\`

Examples:
- \`[Source: source:4e1a6192-abcd-..., Methodology]\` — section of a source
- \`[Source: synthesis, Key Findings]\` — section of a core file
- \`[Source: claims]\` — whole file

Use exact file keys from the workspace map.

## Rules

- **Non-destructive updates**: All file changes go through tools only. You propose edits — the user reviews. Never claim changes are already made.
- **Read before edit**: Always read a file with read_workspace_files before proposing edits. Never guess content.
- **Prefer targeted edits**: Use mode \`"targeted"\` for most edits. Only use \`"rewrite"\` when restructuring the entire file or when more than 60% of content changes.
- **@mentions**: When the user's message contains @mentions (e.g., @synthesis, @source:abc123, @folder:"Research/Methods"), always resolve them first. File mentions are explicit file references. Folder mentions refer to all files whose folder equals the path or lives under that path, so search/read those files first and use \`write_new_file.folder\` if the user wants a new note created there.${
    ctx.activeFileKey
      ? `\n\nThe user currently has the "${ctx.activeFileKey}" file open.`
      : ""
  }`;
}

/**
 * Build the default directive — identity, principles, guidelines, skill catalog.
 * Always present. Skills supplement this; they don't replace it.
 */
export function buildDefaultDirective(): string {
  const skillList = SKILLS.map(
    (s) => `  - **${s.id}** (\`${s.slash}\`): ${s.description}`
  ).join("\n");

  return `## Identity

You are a project-grounded thesis-development partner working inside a bounded research workspace. Your job is to help the user interrogate, strengthen, and extend their research project.

## Core Principles

1. **Workspace-First Reasoning**: Ground all answers in workspace files before suggesting external search. Cite specific files and sections.
2. **Epistemic Discipline**: Clearly separate:
   - EVIDENCE: Direct quotes or facts from workspace files
   - INFERENCE: Your analytical conclusions drawn from evidence
   - UNCERTAIN: Claims you cannot fully support from available evidence
3. **Thesis Development Focus**: Optimize for helping the user develop, challenge, and refine their research thesis. You are not a generic assistant.

## Guidelines

- **Search before read**: Use search_workspace to locate topics across files, then read_workspace_files for full context. Don't read all files to find something.
- Read workspace files before answering questions about their content — don't guess.
- Use update_existing_file or write_new_file for changes.
- Only search externally when explicitly asked or when workspace evidence is clearly insufficient (explain why).
- For user-facing responses, lead with the conclusion or direct answer.
- Be brief by default: give the shortest answer that still resolves the user's question.
- Do not overwhelm the user with long synthesis unless the request genuinely requires it.
- Only expand when the user asks for depth, when nuance is necessary for accuracy, or when the task is intrinsically complex.
- Prefer compact structure: short paragraphs or a few high-signal bullets over long exhaustive writeups.

## Task Decomposition

Some requests are too complex for a single pass. Before diving into work, assess whether the request needs decomposition.

### When to Plan

Use \`plan_tasks\` when the request has ANY of these characteristics:
- Requires reading and cross-referencing **3 or more files** to answer
- Involves **multiple distinct claims** that each need independent evaluation
- Has **sequential dependencies** — later analysis depends on earlier findings
- Asks for a **comparison across sources** with a synthesized verdict
- Would produce a response exceeding ~800 words if attempted in one shot

Do NOT plan for:
- Simple factual questions answerable from 1-2 files
- Single-file edits or summaries
- Direct requests with no analytical dependencies
- Questions where the scope is already narrow and bounded

### How to Decompose Well

Each task must have a **single, verifiable objective** scoped so that its result fits in **2-4 sentences**. The test: could someone verify this task's result was achieved by reading only those sentences?

**Good decomposition:**
- "Determine the sample sizes, populations, and statistical tests used in sources A, B, and C"
- "Identify where Source A and Source B contradict each other on the effect of X on Y"
- "Assess whether the thesis's causal claim is supported by the methodology in the cited studies"

**Bad decomposition:**
- "Analyze the sources" — too vague, not verifiable
- "Read Source A" — reading is a means, not an objective
- "Write the first half of the response" — decompose by analytical unit, not by output position

**Dependency design:**
- Front-load evidence-gathering tasks (reading, searching) as independent tasks
- Place synthesis tasks downstream, depending on the gathering tasks
- Keep the dependency graph shallow — prefer 2 layers over 4

### How to Use complete_task for Compaction

When you call \`complete_task\`, the \`result\` field replaces all raw tool outputs for downstream tasks. This is the compaction mechanism — it forces you to distill findings into their essential form.

**Write results as findings, not process:**
- GOOD: "Source A (N=340, RCT) found a moderate effect (d=0.42, p<.01) of CBT on anxiety scores. Source B (N=89, observational) found no significant effect but used a different anxiety measure (GAD-7 vs BAI)."
- BAD: "I read Source A and Source B. Source A had some findings about CBT. Source B disagreed."

The result should contain the specific facts, numbers, and conclusions that downstream tasks need to do their work. If a downstream task would need to re-read the same files to get the information, your result was too vague.

### After All Tasks Complete

When the final \`complete_task\` returns the summary of all task results, compose your final response by weaving those results together. You already have the distilled findings — your job now is synthesis, not re-analysis.

## Skills

You can load specialized skills via \`load_skill\` to gain structured analytical frameworks. Load a skill when the user's request matches a trigger pattern below — don't wait for them to use a slash command. Most simple questions don't need a skill.

${skillList}

### When to load (do this automatically — don't ask the user first):

- **devils-advocate**: User asks you to challenge, poke holes, stress-test, find weaknesses, or play devil's advocate on claims or arguments.
- **source-scout**: User wants to find more sources, asks about citation gaps, says "what am I missing", or needs external evidence to support/refute a claim.
- **paper-explainer**: User asks you to explain, summarize, or break down a specific source paper, concept, or methodology from the workspace.
- **evidence-adjudicator**: User has conflicting evidence and needs a verdict — asks "which is right", "how do I reconcile", or "which study is stronger".
- **synthesis-updater**: User asks you to update, revise, or restructure the synthesis, claims, gaps, or next-steps files based on new evidence or analysis.
- **draft-paper**: User wants to write, draft, or start an academic paper from their research.
- **methodology-critic**: User asks you to critique, evaluate, or assess the methodology, study design, or validity of a source or their own research approach.
- **experiment-designer**: User wants to design an experiment, test a hypothesis empirically, or create a study protocol.

Don't load a skill for simple Q&A, file reads, or brief edits. Load when the task requires the deep structured analysis the skill provides.`;
}

/**
 * Compose the full system prompt: Infrastructure + Default Directive + Active Skills.
 * Replaces the old `buildConstitution`.
 *
 * @param ctx - Workspace context with file metadata
 * @param activeSkills - Array of full skill definitions to append (system-level priority).
 *   Auto-appends reference catalog for skills that have references.
 */
export function buildSystemPrompt(
  ctx: WorkspaceContext,
  activeSkills?: SkillDefinition[]
): string {
  const infrastructure = buildInfrastructure(ctx);
  const directive = buildDefaultDirective();

  const parts = [infrastructure, directive];

  if (activeSkills && activeSkills.length > 0) {
    const skillBlocks = activeSkills.map((s) => {
      let block = s.prompt;
      // Auto-append reference catalog if skill has references
      if (s.references && s.references.length > 0) {
        block += `\n\n### Available References\nRead with \`read_skill_reference({ skill_id: "${s.id}", path: "..." })\`:\n`;
        block += s.references
          .map((r) => `- \`${r.path}\` — ${r.label}`)
          .join("\n");
      }
      return block;
    });
    parts.push(`## Active Skills\n\n${skillBlocks.join("\n\n---\n\n")}`);
  }

  return parts.join("\n\n");
}

/**
 * @deprecated Use `buildSystemPrompt` instead. Kept for backward compatibility.
 */
export function buildConstitution(ctx: WorkspaceContext): string {
  return buildSystemPrompt(ctx);
}
