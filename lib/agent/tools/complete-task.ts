import type { TaskPlan, TaskState } from "../state";

interface CompleteTaskArgs {
  task_id: string;
  result: string;
}

export function executeCompleteTask(
  args: CompleteTaskArgs,
  plan: TaskPlan | undefined
): {
  result: string;
  updatedPlan: TaskPlan;
  completedTaskId: string;
  nextTask?: TaskState;
} {
  if (!plan || plan.tasks.length === 0) {
    return {
      result: "Error: No task plan is active. Call plan_tasks first.",
      updatedPlan: plan ?? { tasks: [], created: Date.now() },
      completedTaskId: args.task_id,
    };
  }

  const task = plan.tasks.find((t) => t.id === args.task_id);
  if (!task) {
    return {
      result: `Error: Task "${args.task_id}" not found in the current plan.`,
      updatedPlan: plan,
      completedTaskId: args.task_id,
    };
  }

  if (task.status === "completed") {
    return {
      result: `Error: Task "${args.task_id}" is already completed.`,
      updatedPlan: plan,
      completedTaskId: args.task_id,
    };
  }

  if (task.id !== plan.activeTaskId) {
    return {
      result: `Error: Task "${args.task_id}" is not the active task. The active task is "${plan.activeTaskId}".`,
      updatedPlan: plan,
      completedTaskId: args.task_id,
    };
  }

  // Mark task completed with compacted result
  task.status = "completed";
  task.result = args.result;

  // Find next unblocked task: all depends_on must be completed
  const nextTask = plan.tasks.find((t) => {
    if (t.status !== "pending") return false;
    const deps = t.depends_on ?? [];
    return deps.every(
      (depId) => plan.tasks.find((d) => d.id === depId)?.status === "completed"
    );
  });

  if (nextTask) {
    nextTask.status = "active";
    plan.activeTaskId = nextTask.id;

    // Build context injection: collect results from this task's dependencies
    const depResults = (nextTask.depends_on ?? [])
      .map((depId) => {
        const dep = plan.tasks.find((d) => d.id === depId);
        return dep?.result ? `  - [${dep.id}]: "${dep.result}"` : null;
      })
      .filter(Boolean)
      .join("\n");

    let resultText = `Task "${args.task_id}" completed.\n\n--- Next Task ---\nTask ID: ${nextTask.id}\nObjective: ${nextTask.objective}`;

    if (nextTask.context_keys?.length) {
      resultText += `\nContext files to read: ${nextTask.context_keys.map((k) => `"${k}"`).join(", ")}`;
    }

    if (depResults) {
      resultText += `\nDependencies completed:\n${depResults}`;
    }

    const completed = plan.tasks.filter(
      (t) => t.status === "completed"
    ).length;
    resultText += `\n\nProgress: ${completed}/${plan.tasks.length} tasks completed.`;

    return {
      result: resultText,
      updatedPlan: plan,
      completedTaskId: args.task_id,
      nextTask,
    };
  }

  // All tasks done — provide all results for final synthesis
  plan.activeTaskId = undefined;
  const allResults = plan.tasks
    .map((t) => `  - [${t.id}]: ${t.result}`)
    .join("\n");

  const resultText = `Task "${args.task_id}" completed.\n\nAll ${plan.tasks.length} tasks are now complete. Compile your final response using these findings:\n${allResults}`;

  return {
    result: resultText,
    updatedPlan: plan,
    completedTaskId: args.task_id,
  };
}
