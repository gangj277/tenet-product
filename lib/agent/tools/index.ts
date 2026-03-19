import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { AddedSource, ProposedUpdate, WorkspaceContext } from "../state";
import type { SkillDefinition } from "../prompts/skills";
import { executeReadWorkspaceFiles } from "./read-workspace-files";
import { executeUpdateExistingFile } from "./update-existing-file";
import { executeWriteNewFile } from "./write-new-file";
import { executeSearchExternalSources, type ProgressCallback, type SearchExternalSourcesArgs } from "./search-external-sources";
import { executeLoadSkill } from "./load-skill";
import { executeCreatePaper } from "./create-paper";
import { executeCreateExperiment } from "./create-experiment";
import { executeEditExperiment } from "./edit-experiment";
import { executeSearchWorkspace } from "./search-workspace";
import { executeReadSkillReference } from "./read-skill-reference";

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
        'Propose an edit to an existing workspace file. Two modes: "rewrite" (default) replaces the entire file content; "targeted" (recommended) applies surgical string-match edits. Each edit\'s old_str must exactly match text in the file — include enough surrounding context (1-3 lines) to ensure uniqueness. The user will review and accept or reject the change.',
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "The file key to update (must exist in workspace)",
          },
          mode: {
            type: "string",
            enum: ["rewrite", "targeted"],
            description:
              'Edit mode. "rewrite" (default) replaces the entire file. "targeted" (recommended) applies surgical string-match edits.',
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
                old_str: {
                  type: "string",
                  description:
                    "Exact text to find in the file. Must uniquely match one location unless replace_all is true. Include 1-3 lines of surrounding context if needed for uniqueness.",
                },
                new_str: {
                  type: "string",
                  description:
                    'Replacement text. Use "" to delete the matched text.',
                },
                replace_all: {
                  type: "boolean",
                  description:
                    "When true, replace all occurrences of old_str. Default: false (requires unique match).",
                },
              },
              required: ["old_str", "new_str"],
              additionalProperties: false,
            },
            description:
              'Array of string-match edits (required for "targeted" mode). Each edit finds old_str and replaces it with new_str. Edits are applied sequentially — each subsequent edit matches against the result of prior edits.',
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
        "Create a structured experiment design with typed fields for hypotheses, variables, procedure, and analysis plan. Always pass the `design` object — markdown content is not accepted.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the experiment",
          },
          design: {
            type: "object",
            description: "Structured experiment design object",
            properties: {
              version: { type: "number", description: "Schema version. Always 1." },
              title: { type: "string", description: "Experiment title" },
              researchQuestion: { type: "string", description: "The specific question this experiment tests" },
              motivation: { type: "string", description: "Why this experiment matters — cite workspace sources" },
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "Label: H₀, H₁, H₁ₐ, etc." },
                    type: { type: "string", enum: ["null", "alternative"] },
                    statement: { type: "string", description: "Precise, falsifiable hypothesis statement" },
                  },
                  required: ["id", "type", "statement"],
                },
              },
              variables: {
                type: "object",
                properties: {
                  independent: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string", description: "What participants experience in each condition" },
                        levels: { type: "array", items: { type: "string" }, description: "Specific conditions/groups" },
                      },
                      required: ["name", "description", "levels"],
                    },
                  },
                  dependent: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        measure: { type: "string", description: "How the variable is operationalized" },
                        instrument: { type: "string", description: "Named scale/tool if applicable" },
                      },
                      required: ["name", "measure"],
                    },
                  },
                  controls: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["name", "rationale"],
                    },
                  },
                },
                required: ["independent", "dependent", "controls"],
              },
              design: {
                type: "object",
                properties: {
                  type: { type: "string", description: "e.g. Between-subjects RCT, 2x3 mixed factorial" },
                  justification: { type: "string", description: "Why this design over alternatives" },
                },
                required: ["type", "justification"],
              },
              sample: {
                type: "object",
                properties: {
                  population: { type: "string" },
                  targetN: { type: "number", description: "Target sample size" },
                  powerRationale: { type: "string", description: "Effect size basis and power level" },
                  recruitment: { type: "string" },
                },
                required: ["population", "targetN", "powerRationale", "recruitment"],
              },
              procedure: { type: "array", items: { type: "string" }, description: "Ordered steps of the protocol" },
              analysis: {
                type: "object",
                properties: {
                  primaryTest: { type: "string", description: "e.g. One-way ANOVA, Mixed-effects regression" },
                  alpha: { type: "string", description: "e.g. α = .05 with Bonferroni correction" },
                  effectSizeMeasure: { type: "string", description: "e.g. Cohen's d, η²" },
                  missingDataStrategy: { type: "string" },
                  secondaryAnalyses: { type: "array", items: { type: "string" } },
                },
                required: ["primaryTest", "alpha", "effectSizeMeasure", "missingDataStrategy"],
              },
              limitations: { type: "array", items: { type: "string" }, description: "2-3 most significant limitations" },
              ethics: { type: "string", description: "IRB, consent, data privacy considerations" },
            },
            required: [
              "version", "title", "researchQuestion", "motivation",
              "hypotheses", "variables", "design", "sample",
              "procedure", "analysis", "limitations", "ethics",
            ],
          },
        },
        required: ["title", "design"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_experiment",
      description:
        "Edit an existing structured experiment design. Provide only the fields you want to change — they will be merged with the current design. Arrays (hypotheses, procedure, limitations) are replaced wholesale, so include the full updated array. The user will review and accept or reject the change.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              'The experiment key, e.g. "experiment:abc123" or just "abc123"',
          },
          updates: {
            type: "object",
            description:
              "Partial ExperimentDesign object — only include fields you want to change",
            properties: {
              title: { type: "string" },
              researchQuestion: { type: "string" },
              motivation: { type: "string" },
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string", enum: ["null", "alternative"] },
                    statement: { type: "string" },
                  },
                  required: ["id", "type", "statement"],
                },
              },
              variables: {
                type: "object",
                properties: {
                  independent: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        levels: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "description", "levels"],
                    },
                  },
                  dependent: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        measure: { type: "string" },
                        instrument: { type: "string" },
                      },
                      required: ["name", "measure"],
                    },
                  },
                  controls: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["name", "rationale"],
                    },
                  },
                },
              },
              design: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  justification: { type: "string" },
                },
              },
              sample: {
                type: "object",
                properties: {
                  population: { type: "string" },
                  targetN: { type: "number" },
                  powerRationale: { type: "string" },
                  recruitment: { type: "string" },
                },
              },
              procedure: { type: "array", items: { type: "string" } },
              analysis: {
                type: "object",
                properties: {
                  primaryTest: { type: "string" },
                  alpha: { type: "string" },
                  effectSizeMeasure: { type: "string" },
                  missingDataStrategy: { type: "string" },
                  secondaryAnalyses: { type: "array", items: { type: "string" } },
                },
              },
              limitations: { type: "array", items: { type: "string" } },
              ethics: { type: "string" },
            },
          },
          summary: {
            type: "string",
            description: "Brief summary of what changed and why",
          },
        },
        required: ["key", "updates", "summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "Load a specialized skill to gain a structured analytical framework for the current task. Load proactively when the user's request matches — don't wait for slash commands. Skills: devils-advocate (challenge/stress-test claims), source-scout (find sources, identify citation gaps), paper-explainer (explain a specific paper or concept), evidence-adjudicator (weigh conflicting evidence, render verdict), synthesis-updater (revise synthesis/claims/gaps/next-steps files), draft-paper (draft LaTeX academic paper), methodology-critic (critique study design or methodology), experiment-designer (design structured experiments with hypotheses and analysis plans).",
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
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Pause and ask the user a clarifying question with 2-4 structured options. Use sparingly — only when the user's preference genuinely affects the direction or quality of the output (e.g. which methodology to focus on, which framing to adopt, depth vs breadth trade-off). Do NOT use for questions you can answer yourself from the workspace context.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to ask the user. Should be clear and specific.",
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "Short label for the option (2-6 words)",
                },
                description: {
                  type: "string",
                  description: "Brief explanation of what this option means",
                },
              },
              required: ["label", "description"],
              additionalProperties: false,
            },
            minItems: 2,
            maxItems: 4,
            description: "2-4 options for the user to choose from",
          },
          allow_custom: {
            type: "boolean",
            description: "Whether to allow the user to type a custom answer (default: true)",
          },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  },
];

// ── Skill Reference Tool (conditionally included) ──

export const SKILL_REFERENCE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "read_skill_reference",
    description:
      "Read a reference file from an active skill's reference library. Use this to retrieve venue-specific submission guidelines, paper format structures, or other deep reference material.",
    parameters: {
      type: "object",
      properties: {
        skill_id: {
          type: "string",
          description: "ID of the active skill (e.g. 'draft-paper')",
        },
        path: {
          type: "string",
          description:
            "Reference path (e.g. 'venues/neurips', 'formats/imrad')",
        },
      },
      required: ["skill_id", "path"],
      additionalProperties: false,
    },
  },
};

/**
 * Build the tool schema list, conditionally including read_skill_reference
 * when at least one active skill has references.
 */
export function getToolSchemas(activeSkills: SkillDefinition[]): ToolDefinition[] {
  const hasRefs = activeSkills.some(
    (s) => s.references && s.references.length > 0
  );
  return hasRefs ? [...TOOL_SCHEMAS, SKILL_REFERENCE_TOOL] : TOOL_SCHEMAS;
}

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
  onProgress?: ProgressCallback,
  activeSkills?: SkillDefinition[]
): Promise<ToolExecutionResult> {
  switch (name) {
    case "read_workspace_files": {
      const result = executeReadWorkspaceFiles(
        args as { keys: string[] },
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
        args as Parameters<typeof executeCreateExperiment>[0],
        ctx
      );
      return { result, proposedUpdate: update };
    }

    case "edit_experiment": {
      const { result, update } = executeEditExperiment(
        args as Parameters<typeof executeEditExperiment>[0],
        ctx
      );
      return { result, proposedUpdate: update ?? undefined };
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
        args as { skill_id: string },
        true // promoted: graph.ts handles system-level promotion
      );
      return { result, loadedSkillId: skillId ?? undefined };
    }

    case "read_skill_reference": {
      const refResult = executeReadSkillReference(
        args as { skill_id: string; path: string },
        activeSkills ?? []
      );
      return { result: refResult.result };
    }

    default:
      return { result: `Unknown tool: "${name}"` };
  }
}
