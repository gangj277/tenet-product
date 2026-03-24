import assert from "node:assert/strict";
import test from "node:test";
import { executePlanTasks } from "../lib/agent/tools/plan-tasks";
import { executeCompleteTask } from "../lib/agent/tools/complete-task";
import type { TaskPlan } from "../lib/agent/state";

// ─────────────────────────────────────────────────────────────
// plan_tasks: Plan Creation & Validation
// ─────────────────────────────────────────────────────────────

test("plan_tasks: creates a valid plan with correct task states", () => {
  const { result, taskPlan } = executePlanTasks({
    tasks: [
      { id: "read-sources", objective: "Read source A and B" },
      { id: "compare", objective: "Compare findings", depends_on: ["read-sources"] },
    ],
  });

  assert.equal(taskPlan.tasks.length, 2);
  assert.equal(taskPlan.tasks[0].status, "active");
  assert.equal(taskPlan.tasks[1].status, "pending");
  assert.equal(taskPlan.activeTaskId, "read-sources");
  assert.ok(result.includes("Task plan created with 2 tasks"));
  assert.ok(result.includes("← START"));
});

test("plan_tasks: first task with no dependencies becomes active", () => {
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "First task" },
      { id: "t2", objective: "Second task" },
      { id: "t3", objective: "Third task", depends_on: ["t1", "t2"] },
    ],
  });

  // t1 is first with no deps — becomes active
  assert.equal(taskPlan.tasks[0].status, "active");
  assert.equal(taskPlan.tasks[1].status, "pending");
  assert.equal(taskPlan.tasks[2].status, "pending");
  assert.equal(taskPlan.activeTaskId, "t1");
});

test("plan_tasks: defaults mode to 'inline' when not specified", () => {
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "Task without mode" },
      { id: "t2", objective: "Task with mode", mode: "isolated" },
    ],
  });

  assert.equal(taskPlan.tasks[0].mode, "inline");
  assert.equal(taskPlan.tasks[1].mode, "isolated");
});

test("plan_tasks: preserves context_keys and depends_on", () => {
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "Read", context_keys: ["source:abc", "synthesis"] },
      { id: "t2", objective: "Analyze", depends_on: ["t1"], context_keys: ["claims"] },
    ],
  });

  assert.deepEqual(taskPlan.tasks[0].context_keys, ["source:abc", "synthesis"]);
  assert.deepEqual(taskPlan.tasks[1].depends_on, ["t1"]);
  assert.deepEqual(taskPlan.tasks[1].context_keys, ["claims"]);
});

test("plan_tasks: result includes instruction to read context_keys for first task", () => {
  const { result } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "Read sources", context_keys: ["source:abc", "source:def"] },
      { id: "t2", objective: "Synthesize", depends_on: ["t1"] },
    ],
  });

  assert.ok(result.includes('"source:abc"'));
  assert.ok(result.includes('"source:def"'));
  assert.ok(result.includes("Read these files first"));
});

test("plan_tasks: sets created timestamp", () => {
  const before = Date.now();
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "Task" },
      { id: "t2", objective: "Task 2" },
    ],
  });
  const after = Date.now();

  assert.ok(taskPlan.created >= before);
  assert.ok(taskPlan.created <= after);
});

// ─────────────────────────────────────────────────────────────
// plan_tasks: Validation Errors
// ─────────────────────────────────────────────────────────────

test("plan_tasks: rejects duplicate task IDs", () => {
  const { result, taskPlan } = executePlanTasks({
    tasks: [
      { id: "same-id", objective: "First" },
      { id: "same-id", objective: "Second" },
    ],
  });

  assert.ok(result.includes("Error: Duplicate task ID"));
  assert.ok(result.includes("same-id"));
  assert.equal(taskPlan.tasks.length, 0);
});

test("plan_tasks: rejects missing dependency references", () => {
  const { result, taskPlan } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "First" },
      { id: "t2", objective: "Second", depends_on: ["nonexistent"] },
    ],
  });

  assert.ok(result.includes("Error"));
  assert.ok(result.includes("nonexistent"));
  assert.ok(result.includes("does not exist"));
  assert.equal(taskPlan.tasks.length, 0);
});

test("plan_tasks: detects circular dependency (direct)", () => {
  const { result } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "First", depends_on: ["t2"] },
      { id: "t2", objective: "Second", depends_on: ["t1"] },
    ],
  });

  assert.ok(result.includes("Error: Circular dependency"));
});

test("plan_tasks: detects circular dependency (transitive)", () => {
  const { result } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "First", depends_on: ["t3"] },
      { id: "t2", objective: "Second", depends_on: ["t1"] },
      { id: "t3", objective: "Third", depends_on: ["t2"] },
    ],
  });

  assert.ok(result.includes("Error: Circular dependency"));
});

test("plan_tasks: rejects creating a plan when one already exists", () => {
  const existingPlan: TaskPlan = {
    tasks: [{ id: "t1", objective: "Existing", status: "active", mode: "inline" }],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result, taskPlan } = executePlanTasks(
    { tasks: [{ id: "new", objective: "New task" }, { id: "new2", objective: "New task 2" }] },
    existingPlan
  );

  assert.ok(result.includes("Error: A task plan is already active"));
  // Returns the existing plan unchanged
  assert.equal(taskPlan, existingPlan);
});

// ─────────────────────────────────────────────────────────────
// complete_task: Basic Completion Flow
// ─────────────────────────────────────────────────────────────

test("complete_task: marks active task as completed and activates next", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "active", mode: "inline" },
      { id: "t2", objective: "Second", status: "pending", depends_on: ["t1"], mode: "inline" },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result, updatedPlan, completedTaskId, nextTask } = executeCompleteTask(
    { task_id: "t1", result: "Found evidence X and Y." },
    plan
  );

  assert.equal(completedTaskId, "t1");
  assert.equal(updatedPlan.tasks[0].status, "completed");
  assert.equal(updatedPlan.tasks[0].result, "Found evidence X and Y.");
  assert.equal(updatedPlan.tasks[1].status, "active");
  assert.equal(updatedPlan.activeTaskId, "t2");
  assert.ok(nextTask);
  assert.equal(nextTask!.id, "t2");
  assert.ok(result.includes("--- Next Task ---"));
  assert.ok(result.includes("t2"));
});

test("complete_task: injects dependency results into next task context", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "Gather evidence", status: "active", mode: "inline" },
      { id: "t2", objective: "Synthesize", status: "pending", depends_on: ["t1"], mode: "inline" },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Source A shows effect size d=0.42, Source B shows d=0.15." },
    plan
  );

  assert.ok(result.includes("Dependencies completed:"));
  assert.ok(result.includes("[t1]"));
  assert.ok(result.includes("d=0.42"));
});

test("complete_task: includes context_keys for next task", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "active", mode: "inline" },
      {
        id: "t2",
        objective: "Read and analyze",
        status: "pending",
        depends_on: ["t1"],
        context_keys: ["source:abc", "claims"],
        mode: "inline",
      },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Done." },
    plan
  );

  assert.ok(result.includes("Context files to read:"));
  assert.ok(result.includes('"source:abc"'));
  assert.ok(result.includes('"claims"'));
});

test("complete_task: shows progress counter", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "active", mode: "inline" },
      { id: "t2", objective: "Second", status: "pending", depends_on: ["t1"], mode: "inline" },
      { id: "t3", objective: "Third", status: "pending", depends_on: ["t2"], mode: "inline" },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Done." },
    plan
  );

  assert.ok(result.includes("Progress: 1/3 tasks completed"));
});

// ─────────────────────────────────────────────────────────────
// complete_task: All Tasks Done
// ─────────────────────────────────────────────────────────────

test("complete_task: returns all results when final task completes", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "completed", result: "Finding A.", mode: "inline" },
      { id: "t2", objective: "Second", status: "active", depends_on: ["t1"], mode: "inline" },
    ],
    activeTaskId: "t2",
    created: Date.now(),
  };

  const { result, updatedPlan, nextTask } = executeCompleteTask(
    { task_id: "t2", result: "Finding B." },
    plan
  );

  assert.equal(nextTask, undefined);
  assert.equal(updatedPlan.activeTaskId, undefined);
  assert.ok(result.includes("All 2 tasks are now complete"));
  assert.ok(result.includes("[t1]: Finding A."));
  assert.ok(result.includes("[t2]: Finding B."));
  assert.ok(result.includes("Compile your final response"));
});

// ─────────────────────────────────────────────────────────────
// complete_task: Dependency Unlocking
// ─────────────────────────────────────────────────────────────

test("complete_task: does not unlock task until ALL dependencies are met", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "active", mode: "inline" },
      { id: "t2", objective: "Second", status: "pending", mode: "inline" },
      { id: "t3", objective: "Third", status: "pending", depends_on: ["t1", "t2"], mode: "inline" },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  // Complete t1 — t3 still blocked because t2 isn't done
  const { updatedPlan, nextTask } = executeCompleteTask(
    { task_id: "t1", result: "Done t1." },
    plan
  );

  // t2 should become active (no deps), not t3
  assert.equal(nextTask!.id, "t2");
  assert.equal(updatedPlan.activeTaskId, "t2");
  assert.equal(updatedPlan.tasks[2].status, "pending"); // t3 still pending

  // Now complete t2 — t3 should unlock
  const { updatedPlan: plan2, nextTask: next2 } = executeCompleteTask(
    { task_id: "t2", result: "Done t2." },
    updatedPlan
  );

  assert.equal(next2!.id, "t3");
  assert.equal(plan2.activeTaskId, "t3");
  assert.equal(plan2.tasks[2].status, "active");
});

test("complete_task: collects results from multiple dependencies", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "completed", result: "Result from t1.", mode: "inline" },
      { id: "t2", objective: "Second", status: "active", mode: "inline" },
      { id: "t3", objective: "Synthesize", status: "pending", depends_on: ["t1", "t2"], mode: "inline" },
    ],
    activeTaskId: "t2",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t2", result: "Result from t2." },
    plan
  );

  // t3's context should include both t1 and t2 results
  assert.ok(result.includes("[t1]"));
  assert.ok(result.includes("Result from t1."));
  assert.ok(result.includes("[t2]"));
  assert.ok(result.includes("Result from t2."));
});

// ─────────────────────────────────────────────────────────────
// complete_task: Validation Errors
// ─────────────────────────────────────────────────────────────

test("complete_task: rejects when no plan exists", () => {
  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Done." },
    undefined
  );

  assert.ok(result.includes("Error: No task plan is active"));
});

test("complete_task: rejects unknown task ID", () => {
  const plan: TaskPlan = {
    tasks: [{ id: "t1", objective: "First", status: "active", mode: "inline" }],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "nonexistent", result: "Done." },
    plan
  );

  assert.ok(result.includes("Error"));
  assert.ok(result.includes("nonexistent"));
  assert.ok(result.includes("not found"));
});

test("complete_task: rejects completing an already-completed task", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "completed", result: "Old result.", mode: "inline" },
      { id: "t2", objective: "Second", status: "active", depends_on: ["t1"], mode: "inline" },
    ],
    activeTaskId: "t2",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Trying to re-complete." },
    plan
  );

  assert.ok(result.includes("Error"));
  assert.ok(result.includes("already completed"));
});

test("complete_task: rejects completing a non-active task", () => {
  const plan: TaskPlan = {
    tasks: [
      { id: "t1", objective: "First", status: "active", mode: "inline" },
      { id: "t2", objective: "Second", status: "pending", depends_on: ["t1"], mode: "inline" },
    ],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const { result } = executeCompleteTask(
    { task_id: "t2", result: "Jumping ahead." },
    plan
  );

  assert.ok(result.includes("Error"));
  assert.ok(result.includes("not the active task"));
  assert.ok(result.includes('"t1"'));
});

// ─────────────────────────────────────────────────────────────
// End-to-End: plan_tasks → complete_task full flow
// ─────────────────────────────────────────────────────────────

test("end-to-end: create plan then complete all tasks sequentially", () => {
  // Step 1: Create plan
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "gather", objective: "Gather evidence from sources", context_keys: ["source:a", "source:b"] },
      { id: "evaluate", objective: "Evaluate methodology", context_keys: ["source:a"], depends_on: ["gather"] },
      { id: "synthesize", objective: "Synthesize verdict", depends_on: ["gather", "evaluate"] },
    ],
  });

  assert.equal(taskPlan.tasks.length, 3);
  assert.equal(taskPlan.activeTaskId, "gather");

  // Step 2: Complete "gather"
  const step2 = executeCompleteTask(
    { task_id: "gather", result: "Source A (N=200, RCT) found d=0.5. Source B (N=50, obs) found no effect." },
    taskPlan
  );

  assert.equal(step2.completedTaskId, "gather");
  assert.equal(step2.nextTask!.id, "evaluate");
  assert.equal(step2.updatedPlan.tasks[0].status, "completed");
  assert.equal(step2.updatedPlan.tasks[1].status, "active");
  assert.equal(step2.updatedPlan.tasks[2].status, "pending"); // still blocked on evaluate

  // Step 3: Complete "evaluate"
  const step3 = executeCompleteTask(
    { task_id: "evaluate", result: "Source A has strong internal validity. Source B has selection bias." },
    step2.updatedPlan
  );

  assert.equal(step3.completedTaskId, "evaluate");
  assert.equal(step3.nextTask!.id, "synthesize");
  assert.equal(step3.updatedPlan.tasks[2].status, "active");

  // Verify synthesize gets both dependency results
  assert.ok(step3.result.includes("[gather]"));
  assert.ok(step3.result.includes("d=0.5"));
  assert.ok(step3.result.includes("[evaluate]"));
  assert.ok(step3.result.includes("internal validity"));

  // Step 4: Complete "synthesize" — all done
  const step4 = executeCompleteTask(
    { task_id: "synthesize", result: "Source A provides stronger evidence due to RCT design and larger sample." },
    step3.updatedPlan
  );

  assert.equal(step4.nextTask, undefined);
  assert.equal(step4.updatedPlan.activeTaskId, undefined);
  assert.ok(step4.result.includes("All 3 tasks are now complete"));
  assert.ok(step4.result.includes("[gather]"));
  assert.ok(step4.result.includes("[evaluate]"));
  assert.ok(step4.result.includes("[synthesize]"));

  // All tasks completed
  assert.ok(step4.updatedPlan.tasks.every((t) => t.status === "completed"));
});

test("end-to-end: parallel independent tasks then dependent synthesis", () => {
  // Two independent evidence-gathering tasks, then one synthesis
  const { taskPlan } = executePlanTasks({
    tasks: [
      { id: "evidence-a", objective: "Analyze Source A methodology" },
      { id: "evidence-b", objective: "Analyze Source B methodology" },
      { id: "compare", objective: "Compare and render verdict", depends_on: ["evidence-a", "evidence-b"] },
    ],
  });

  // evidence-a is first (no deps) → active
  assert.equal(taskPlan.activeTaskId, "evidence-a");

  // Complete evidence-a → evidence-b becomes active (no deps, still pending)
  const step1 = executeCompleteTask(
    { task_id: "evidence-a", result: "Source A: RCT, N=300, strong design." },
    taskPlan
  );
  assert.equal(step1.nextTask!.id, "evidence-b");
  // compare still blocked
  assert.equal(step1.updatedPlan.tasks[2].status, "pending");

  // Complete evidence-b → compare becomes active (both deps met)
  const step2 = executeCompleteTask(
    { task_id: "evidence-b", result: "Source B: observational, N=80, weak controls." },
    step1.updatedPlan
  );
  assert.equal(step2.nextTask!.id, "compare");
  assert.equal(step2.updatedPlan.tasks[2].status, "active");

  // compare's context has both results
  assert.ok(step2.result.includes("Source A: RCT"));
  assert.ok(step2.result.includes("Source B: observational"));
});

// ─────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────

test("plan_tasks: handles self-dependency as circular", () => {
  const { result } = executePlanTasks({
    tasks: [
      { id: "t1", objective: "Self-dependent", depends_on: ["t1"] },
      { id: "t2", objective: "Other" },
    ],
  });

  assert.ok(result.includes("Error: Circular dependency"));
});

test("complete_task: empty plan (zero tasks) returns error", () => {
  const emptyPlan: TaskPlan = { tasks: [], created: Date.now() };

  const { result } = executeCompleteTask(
    { task_id: "t1", result: "Done." },
    emptyPlan
  );

  assert.ok(result.includes("Error: No task plan is active"));
});
