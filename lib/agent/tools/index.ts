import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { AddedSource, ProposedUpdate, WorkspaceContext } from "../state";
import { executeReadWorkspaceFiles } from "./read-workspace-files";
import { executeUpdateExistingFile } from "./update-existing-file";
import { executeWriteNewFile } from "./write-new-file";
import { executeSearchExternalSources, type ProgressCallback, type SearchExternalSourcesArgs } from "./search-external-sources";
import { executeLoadSkill } from "./load-skill";
import { executeCreatePaper } from "./create-paper";
import { executeCreateExperiment } from "./create-experiment";
import { executeSearchWorkspace } from "./search-workspace";

// ── OpenAI-format Tool Schemas ──

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_SCHEMAS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_workspace_files",
      description:
        "Read one or more workspace files by key. Returns the content of each requested file.",
      parameters: {
        type: "object",
        properties: {
          keys: {
            type: "array",
            items: { type: "string" },
            description:
              'Array of file keys to read, e.g. ["overview", "synthesis", "source:abc123"]',
          },
          line_numbers: {
            type: "boolean",
            description:
              "When true, prefix each line with its 1-indexed line number (e.g. '1| ...') for use with line_edit mode.",
          },
        },
        required: ["keys"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_workspace",
      description:
        "Search across all workspace files for one or more terms. Returns matching lines with surrounding context and line numbers. Use this BEFORE read_workspace_files when you need to locate where a topic, term, or claim is discussed without reading entire files.",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: { type: "string" },
            description:
              'One or more search terms (OR logic — matches lines containing ANY term). Use multiple terms for related concepts, e.g. ["sample size", "participants", "n=", "respondents"].',
          },
          context_lines: {
            type: "number",
            description:
              "Number of lines to show before and after each match (default: 2).",
          },
          file_keys: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional: only search these specific files. Omit to search all workspace files.",
          },
          max_results: {
            type: "number",
            description:
              "Maximum number of matches to return (default: 20). Use a lower value for broad queries.",
          },
        },
        required: ["queries"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_existing_file",
      description:
        'Propose an edit to an existing workspace file. Two modes: "rewrite" (default) replaces the entire file content; "line_edit" applies targeted edits to specific line ranges (read the file with line_numbers: true first to get accurate line references). The user will review and accept or reject the change.',
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "The file key to update (must exist in workspace)",
          },
          mode: {
            type: "string",
            enum: ["rewrite", "line_edit"],
            description:
              'Edit mode. "rewrite" (default) replaces the entire file. "line_edit" applies targeted line-range edits.',
          },
          content: {
            type: "string",
            description:
              'The complete new content for the file (required for "rewrite" mode)',
          },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start_line: {
                  type: "number",
                  description: "Start line number (1-indexed, inclusive)",
                },
                end_line: {
                  type: "number",
                  description: "End line number (1-indexed, inclusive)",
                },
                content: {
                  type: "string",
                  description:
                    'Replacement content for the line range. Use "" to delete lines.',
                },
              },
              required: ["start_line", "end_line", "content"],
              additionalProperties: false,
            },
            description:
              'Array of line-range edits (required for "line_edit" mode). Each edit replaces lines start_line..end_line with the given content.',
          },
          summary: {
            type: "string",
            description: "Brief summary of what changed and why",
          },
        },
        required: ["key", "summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_new_file",
      description:
        "Propose a new file for the workspace. The user will review and accept or reject.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              "Unique key for the new file (must not already exist)",
          },
          label: {
            type: "string",
            description: "Human-readable label for the file",
          },
          content: {
            type: "string",
            description: "The content for the new file",
          },
        },
        required: ["key", "label", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_external_sources",
      description:
        "Search for external academic sources using 1-2 targeted queries. Each query has a short keyword phrase and an intent describing what you're looking for. When extraction_goal is provided, performs deep search: fetches paper content, extracts findings relevant to your goal, and returns structured evidence with quotes. Without extraction_goal, returns metadata only.",
      parameters: {
        type: "object",
        properties: {
          searches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Short keyword-dense search query (3-8 words) optimized for academic search APIs",
                },
                intent: {
                  type: "string",
                  description: "Brief description of what you hope to find with this query, e.g. 'empirical evidence for CBT efficacy' or 'methodological critiques of self-report measures'",
                },
              },
              required: ["query", "intent"],
              additionalProperties: false,
            },
            minItems: 1,
            maxItems: 2,
            description: "1-2 search queries, each targeting a different angle of the research question",
          },
          num_results: {
            type: "number",
            description: "Total number of results to discover across all queries (default: 8, max: 20)",
          },
          extraction_goal: {
            type: "string",
            description:
              "What specific information to extract from the papers. When provided, the tool fetches and reads full paper content, then extracts findings relevant to this goal. Takes 1-3 minutes. Example: 'What sample sizes and effect sizes were reported for CBT interventions on anxiety?'",
          },
        },
        required: ["searches"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_paper",
      description:
        "Create a new LaTeX paper in the workspace. The paper will be proposed as a new file for user review. Use this to draft academic papers from workspace research content.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the paper",
          },
          content: {
            type: "string",
            description: "Complete LaTeX source code for the paper",
          },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_experiment",
      description:
        "Create a new experiment design in the workspace. The experiment will be proposed as a new file for user review. Use this to draft structured experiment designs with hypotheses, variables, methodology, and analysis plans.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the experiment",
          },
          content: {
            type: "string",
            description: "Complete experiment design in markdown format",
          },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "Load a specialized skill to enhance your capabilities for the current task. Use this when you need a specific analytical approach. Available skills: devils-advocate (challenge claims), source-scout (find sources), paper-explainer (explain papers), evidence-adjudicator (weigh evidence), synthesis-updater (propose file updates), draft-paper (draft LaTeX paper), methodology-critic (critique methods), experiment-designer (design experiments).",
      parameters: {
        type: "object",
        properties: {
          skill_id: {
            type: "string",
            description:
              "The skill to load. One of: devils-advocate, source-scout, paper-explainer, evidence-adjudicator, synthesis-updater, draft-paper, methodology-critic, experiment-designer",
          },
        },
        required: ["skill_id"],
        additionalProperties: false,
      },
    },
  },
];

// ── Tool Dispatcher ──

export interface ToolExecutionResult {
  result: string;
  proposedUpdate?: ProposedUpdate;
  searchResults?: DiscoveredSource[];
  loadedSkillId?: string;
  addedSources?: AddedSource[];
}

/**
 * Dispatch a tool call by name and execute it.
 * `onProgress` is called with status messages during long-running tools (e.g. deep search).
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: WorkspaceContext,
  onProgress?: ProgressCallback
): Promise<ToolExecutionResult> {
  switch (name) {
    case "read_workspace_files": {
      const result = executeReadWorkspaceFiles(
        args as { keys: string[]; line_numbers?: boolean },
        ctx
      );
      return { result };
    }

    case "search_workspace": {
      const result = executeSearchWorkspace(
        args as { queries: string[]; context_lines?: number; file_keys?: string[]; max_results?: number },
        ctx
      );
      return { result };
    }

    case "update_existing_file": {
      const { result, update } = executeUpdateExistingFile(
        args as Parameters<typeof executeUpdateExistingFile>[0],
        ctx
      );
      return { result, proposedUpdate: update ?? undefined };
    }

    case "write_new_file": {
      const { result, update } = executeWriteNewFile(
        args as { key: string; label: string; content: string },
        ctx
      );
      return { result, proposedUpdate: update ?? undefined };
    }

    case "create_paper": {
      const { result, update } = executeCreatePaper(
        args as { title: string; content: string },
        ctx
      );
      return { result, proposedUpdate: update };
    }

    case "create_experiment": {
      const { result, update } = executeCreateExperiment(
        args as { title: string; content: string },
        ctx
      );
      return { result, proposedUpdate: update };
    }

    case "search_external_sources": {
      const { result, sources, addedSources } = await executeSearchExternalSources(
        args as unknown as SearchExternalSourcesArgs,
        onProgress,
        ctx
      );
      return {
        result,
        searchResults: sources.length > 0 ? sources : undefined,
        addedSources: addedSources?.length ? addedSources : undefined,
      };
    }

    case "load_skill": {
      const { result, skillId } = executeLoadSkill(
        args as { skill_id: string }
      );
      return { result, loadedSkillId: skillId ?? undefined };
    }

    default:
      return { result: `Unknown tool: "${name}"` };
  }
}
