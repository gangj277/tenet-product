import type { TaskDefinition, TaskPlan, TaskState } from "../state";

interface PlanTasksArgs {
  tasks: TaskDefinition[];
}

export function executePlanTasks(
  args: PlanTasksArgs,
  existingPlan?: TaskPlan
): { result: string; taskPlan: TaskPlan } {
  // Reject if plan already exists
  if (existingPlan && existingPlan.tasks.length > 0) {
    return {
      result:
        "Error: A task plan is already active. Complete all current tasks before creating a new plan.",
      taskPlan: existingPlan,
    };
  }

  // Validate: check for duplicate IDs
  const ids = new Set<string>();
  for (const t of args.tasks) {
    if (ids.has(t.id)) {
      return {
        result: `Error: Duplicate task ID "${t.id}". Each task must have a unique ID.`,
        taskPlan: { tasks: [], created: Date.now() },
      };
    }
    ids.add(t.id);
  }

  // Validate: check depends_on references exist
  for (const t of args.tasks) {
    for (const dep of t.depends_on ?? []) {
      if (!ids.has(dep)) {
        return {
          result: `Error: Task "${t.id}" depends on "${dep}" which does not exist in the plan.`,
          taskPlan: { tasks: [], created: Date.now() },
        };
      }
    }
  }

  // Validate: detect circular dependencies (DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const taskMap = new Map(args.tasks.map((t) => [t.id, t]));

  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of taskMap.get(id)?.depends_on ?? []) {
      if (hasCycle(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const t of args.tasks) {
    if (hasCycle(t.id)) {
      return {
        result: `Error: Circular dependency detected involving task "${t.id}".`,
        taskPlan: { tasks: [], created: Date.now() },
      };
    }
  }

  // Build task states — all start as "pending"
  const taskStates: TaskState[] = args.tasks.map((t) => ({
    ...t,
    mode: t.mode ?? "inline",
    status: "pending" as const,
  }));

  // Find the first task with no unmet dependencies
  const firstTask = taskStates.find((t) => !t.depends_on?.length);

  if (firstTask) {
    firstTask.status = "active";
  }

  const plan: TaskPlan = {
    tasks: taskStates,
    activeTaskId: firstTask?.id,
    created: Date.now(),
  };

  // Build human-readable summary
  const summary = taskStates
    .map((t, i) => {
      const deps = t.depends_on?.length
        ? ` (after: ${t.depends_on.join(", ")})`
        : "";
      const active = t.id === firstTask?.id ? " ← START" : "";
      return `  ${i + 1}. [${t.id}] ${t.objective}${deps}${active}`;
    })
    .join("\n");

  const result = `Task plan created with ${taskStates.length} tasks.\n\n${summary}\n\nNote: All tasks will execute inline in the current conversation.\n\nBegin working on task "${firstTask?.id}": ${firstTask?.objective}${
    firstTask?.context_keys?.length
      ? `\nRead these files first: ${firstTask.context_keys.map((k) => `"${k}"`).join(", ")}`
      : ""
  }`;

  return { result, taskPlan: plan };
}
