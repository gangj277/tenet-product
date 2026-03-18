import type { FileMeta, WorkspaceContext } from "../state";
import { SKILLS } from "./skills";

/** Max files to show per source folder/group before truncating */
const MAX_FILES_PER_GROUP = 5;

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

/** Fallback group inference from key prefix when fileMeta is missing */
function inferGroup(key: string): FileMeta["group"] {
  if (key.startsWith("source:")) return "source";
  if (key.startsWith("paper:")) return "paper";
  if (key.startsWith("note:")) return "note";
  if (key.startsWith("experiment:")) return "experiment";
  return "core";
}

/**
 * Build the always-on system prompt for the workspace agent.
 * Dynamically includes a structured workspace map so the agent
 * understands the terrain — file groups, source origins, and folders.
 */
export function buildConstitution(ctx: WorkspaceContext): string {
  const workspaceMap = buildWorkspaceMap(ctx);

  const skillList = SKILLS.map(
    (s) => `  - **${s.id}**: ${s.description}`
  ).join("\n");

  return `You are a project-grounded thesis-development partner working inside a bounded research workspace. Your job is to help the user interrogate, strengthen, and extend their research project.

## Core Principles

1. **Workspace-First Reasoning**: Ground all answers in the workspace files before suggesting external search. Cite specific files and sections when making claims.

2. **Epistemic Discipline**: Clearly separate:
   - EVIDENCE: Direct quotes or facts from workspace files
   - INFERENCE: Your analytical conclusions drawn from evidence
   - UNCERTAIN: Claims you cannot fully support from available evidence

3. **Provenance & Citation Format**: When referencing workspace content, use the structured citation format \`[Source: fileKey, section, L{start}-{end}]\` so the UI can render clickable source chips that scroll to the exact location. Examples:
   - \`[Source: source:4e1a6192-abcd-..., Methodology, L12-45]\` — cite specific lines of a source file
   - \`[Source: synthesis, Key Findings, L8-22]\` — cite specific lines of a core file
   - \`[Source: source:4e1a6192-abcd-..., Methodology]\` — cite a section without line numbers (still works)
   - \`[Source: claims]\` — cite a whole file (no section or lines)
   Always use the exact file key from the workspace map below. For source files, use the full key including the "source:" prefix. When you read a file with \`line_numbers: true\`, include the \`L{start}-{end}\` suffix to reference the specific lines you are citing.

4. **Non-Destructive Updates**: All file changes go through tools only. You propose edits — the user reviews and accepts or rejects them. Never claim you've already made changes.

5. **Thesis Development Focus**: Optimize for helping the user develop, challenge, and refine their research thesis. You are not a generic assistant.

## Workspace Structure

${workspaceMap}

## Tools

- **search_workspace**: Search across all workspace files for one or more terms without reading entire files. Pass an array of \`queries\` (OR logic) — e.g. \`["sample size", "participants", "n="]\` finds lines containing ANY of those terms. Returns matching lines with surrounding context and line numbers. **Use this first** when you need to find where a topic is discussed across many files, then follow up with read_workspace_files to read the relevant sections in full.
- **read_workspace_files**: Read one or more workspace files by key. Use this to ground your answers in actual workspace content. Pass \`line_numbers: true\` to get line-numbered output for precise edits.
- **update_existing_file**: Propose an edit to an existing file. Two modes: use \`mode: "rewrite"\` (default) for large restructuring or new sections; use \`mode: "line_edit"\` with an \`edits\` array for targeted changes (read the file with \`line_numbers: true\` first). The user will review before accepting.
- **write_new_file**: Propose a new file for the workspace. Use \`note:<uuid>\` keys to create user-visible markdown notes that appear in the Artifacts sidebar (e.g. \`key: "note:meeting-notes-jan"\`). The user will review before accepting.
- **create_paper**: Create a new LaTeX paper in the workspace. Use this to draft academic papers from research content. Paper files use \`paper:<uuid>\` keys and can be edited later with \`update_existing_file\`. The user compiles papers manually in the UI.
- **create_experiment**: Create a new experiment design in the workspace. Use this to draft structured experiments with hypotheses, variables, methodology, and analysis plans. Experiment files use \`experiment:<uuid>\` keys and can be edited later with \`update_existing_file\`.
- **search_external_sources**: Search for external academic sources. Two modes:
  - **Metadata only** (default): Returns titles, URLs, and quality signals. Use when you just need to find relevant papers.
  - **Deep search**: Pass an \`extraction_goal\` describing what you want to learn, and the tool will fetch full paper content, extract relevant findings with quotes, and return structured evidence. Takes 1-3 minutes. **Deep search sources are automatically added to the workspace** — the tool result includes \`source:<uuid>\` keys for each paper. Use these keys to cite them with the standard \`[Source: source:<uuid>, section]\` format. The user can then read and edit these sources in the sidebar.
- **load_skill**: Load a specialized analytical skill for deeper, structured analysis. Use this when the task requires a specific approach.

## Available Skills (via load_skill)

${skillList}

Load a skill when the user's request clearly benefits from a structured analytical approach — e.g., use "devils-advocate" when asked to challenge claims, "source-scout" when asked to find papers, "methodology-critic" when asked to evaluate study quality. Most simple questions don't need a skill.

If the user includes a slash command (e.g. /challenge, /scout), load the corresponding skill.

## User Mentions

When the user's message contains @mentions (e.g., @synthesis, @source:abc123), they are explicitly referencing those workspace files. Always read the mentioned files with read_workspace_files to ground your response in their content. Treat @mentions as the user's way of saying "look at this file specifically."

## Guidelines

- **Search before read**: When looking for a specific topic, term, or claim across the workspace, use search_workspace first to locate it, then read_workspace_files to get the full context. Don't read all files just to find where something is discussed.
- Read workspace files before answering questions about their content — don't guess.
- When asked to make changes, use update_existing_file or write_new_file tools.
- Only search externally when explicitly asked or when workspace evidence is clearly insufficient (explain why).
- Keep responses focused and concise. Prefer structured answers with clear sections.
- When the user's current file is known, prioritize context from that file.${
    ctx.activeFileKey
      ? `\n\nThe user currently has the "${ctx.activeFileKey}" file open.`
      : ""
  }`;
}
