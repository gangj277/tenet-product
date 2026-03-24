import type { WorkspaceContext, TaskPlan } from "../state";
import type { SkillDefinition } from "../prompts/skills";
import type { ToolExecutionResult } from "./tool-types";
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
import { executePlanTasks } from "./plan-tasks";
import { executeCompleteTask } from "./complete-task";

/**
 * Dispatch a tool call by name and execute it.
 * `onProgress` is called with status messages during long-running tools (e.g. deep search).
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: WorkspaceContext,
  onProgress?: ProgressCallback,
  activeSkills?: SkillDefinition[],
  currentTaskPlan?: TaskPlan
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
        args as { key: string; label: string; content: string; folder?: string },
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

    case "plan_tasks": {
      const { result, taskPlan } = executePlanTasks(
        args as { tasks: Array<{ id: string; objective: string; context_keys?: string[]; depends_on?: string[]; mode?: "inline" | "isolated" }> },
        currentTaskPlan
      );
      return { result, taskPlan };
    }

    case "complete_task": {
      const { result, updatedPlan, completedTaskId, nextTask } =
        executeCompleteTask(
          args as { task_id: string; result: string },
          currentTaskPlan
        );
      return { result, taskPlan: updatedPlan, completedTaskId, nextTask };
    }

    default:
      return { result: `Unknown tool: "${name}"` };
  }
}
