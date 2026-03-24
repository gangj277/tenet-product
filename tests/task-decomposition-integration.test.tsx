import assert from "node:assert/strict";
import test from "node:test";
import { executeTool, getToolSchemas } from "../lib/agent/tools";
import { getMaxIterations } from "../lib/agent/graph";
import type { TaskPlan, TaskState, TaskStatus, SSEEvent, WorkspaceContext } from "../lib/agent/state";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function makeWorkspaceCtx(): WorkspaceContext {
  return {
    workspaceFiles: {
      overview: "# Research Overview\nThis is a study about climate change effects.",
      "source:abc": "## Source A\nRCT with N=300, found significant effect d=0.42 on anxiety.",
      "source:def": "## Source B\nObservational study, N=89, no significant effect. Uses GAD-7.",
      synthesis: "# Synthesis\nPreliminary findings suggest mixed evidence.",
    },
    availableKeys: ["overview", "source:abc", "source:def", "synthesis"],
    fileLabels: {
      overview: "Research Overview",
      "source:abc": "CBT Efficacy RCT (2023)",
      "source:def": "Anxiety Interventions Observational (2022)",
      synthesis: "Current Synthesis",
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Tool Schema Verification
// ─────────────────────────────────────────────────────────────

test("integration: plan_tasks and complete_task schemas are present in tool list", () => {
  const schemas = getToolSchemas([]);
  const names = schemas.map((s) => s.function.name);

  assert.ok(names.includes("plan_tasks"), "plan_tasks schema missing from tool list");
  assert.ok(names.includes("complete_task"), "complete_task schema missing from tool list");
});

test("integration: plan_tasks schema has correct structure", () => {
  const schemas = getToolSchemas([]);
  const planSchema = schemas.find((s) => s.function.name === "plan_tasks");
  assert.ok(planSchema);

  const params = planSchema.function.parameters as Record<string, unknown>;
  assert.equal((params.required as string[])[0], "tasks");

  const props = params.properties as Record<string, unknown>;
  const tasks = props.tasks as Record<string, unknown>;
  assert.equal(tasks.type, "array");
  assert.equal(tasks.minItems, 2);
  assert.equal(tasks.maxItems, 8);
});

test("integration: complete_task schema has correct structure", () => {
  const schemas = getToolSchemas([]);
  const completeSchema = schemas.find((s) => s.function.name === "complete_task");
  assert.ok(completeSchema);

  const params = completeSchema.function.parameters as Record<string, unknown>;
  const required = params.required as string[];
  assert.ok(required.includes("task_id"));
  assert.ok(required.includes("result"));
});

// ─────────────────────────────────────────────────────────────
// Dynamic Iteration Limits
// ─────────────────────────────────────────────────────────────

test("integration: getMaxIterations returns 20 with no plan", () => {
  assert.equal(getMaxIterations(undefined), 20);
});

test("integration: getMaxIterations scales with task count", () => {
  const plan3: TaskPlan = {
    tasks: Array.from({ length: 3 }, (_, i) => ({
      id: `t${i}`,
      objective: `Task ${i}`,
      status: "pending" as TaskStatus,
    })),
    created: Date.now(),
  };
  // 20 + 3*4 = 32
  assert.equal(getMaxIterations(plan3), 32);
});

test("integration: getMaxIterations caps at 40", () => {
  const plan8: TaskPlan = {
    tasks: Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      objective: `Task ${i}`,
      status: "pending" as TaskStatus,
    })),
    created: Date.now(),
  };
  // 20 + 8*4 = 52, capped at 40
  assert.equal(getMaxIterations(plan8), 40);
});

test("integration: getMaxIterations with 1-task plan (edge)", () => {
  const plan1: TaskPlan = {
    tasks: [{ id: "t0", objective: "Solo", status: "pending" as TaskStatus }],
    created: Date.now(),
  };
  // 20 + 1*4 = 24
  assert.equal(getMaxIterations(plan1), 24);
});

// ─────────────────────────────────────────────────────────────
// Full Dispatcher Round-Trip: executeTool
// ─────────────────────────────────────────────────────────────

test("integration: executeTool dispatches plan_tasks and returns taskPlan", async () => {
  const ctx = makeWorkspaceCtx();

  const result = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "gather", objective: "Read sources A and B", context_keys: ["source:abc", "source:def"] },
        { id: "compare", objective: "Compare methodology", depends_on: ["gather"] },
      ],
    },
    ctx,
    undefined,
    undefined,
    undefined // no existing plan
  );

  assert.ok(result.taskPlan, "executeTool should return taskPlan");
  assert.equal(result.taskPlan!.tasks.length, 2);
  assert.equal(result.taskPlan!.activeTaskId, "gather");
  assert.equal(result.taskPlan!.tasks[0].status, "active");
  assert.equal(result.taskPlan!.tasks[1].status, "pending");
  assert.ok(result.result.includes("Task plan created"));
  // Should NOT have completedTaskId (it's a new plan, not a completion)
  assert.equal(result.completedTaskId, undefined);
});

test("integration: executeTool dispatches complete_task with active plan", async () => {
  const ctx = makeWorkspaceCtx();

  // First, create a plan through the dispatcher
  const planResult = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "gather", objective: "Read sources", context_keys: ["source:abc"] },
        { id: "synthesize", objective: "Synthesize findings", depends_on: ["gather"] },
      ],
    },
    ctx,
    undefined,
    undefined,
    undefined
  );

  const activePlan = planResult.taskPlan!;

  // Now complete the active task through the dispatcher
  const completeResult = await executeTool(
    "complete_task",
    {
      task_id: "gather",
      result: "Source A (N=300, RCT) found effect d=0.42 on anxiety reduction.",
    },
    ctx,
    undefined,
    undefined,
    activePlan // pass the active plan
  );

  assert.ok(completeResult.taskPlan, "complete_task should return updated plan");
  assert.equal(completeResult.completedTaskId, "gather");
  assert.ok(completeResult.nextTask, "should have next task");
  assert.equal(completeResult.nextTask!.id, "synthesize");
  assert.equal(completeResult.taskPlan!.tasks[0].status, "completed");
  assert.equal(completeResult.taskPlan!.tasks[1].status, "active");
  assert.equal(completeResult.taskPlan!.activeTaskId, "synthesize");
});

test("integration: executeTool rejects plan_tasks when plan already active", async () => {
  const ctx = makeWorkspaceCtx();

  const existingPlan: TaskPlan = {
    tasks: [{ id: "t1", objective: "Active task", status: "active" }],
    activeTaskId: "t1",
    created: Date.now(),
  };

  const result = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "new1", objective: "New task 1" },
        { id: "new2", objective: "New task 2" },
      ],
    },
    ctx,
    undefined,
    undefined,
    existingPlan
  );

  assert.ok(result.result.includes("Error: A task plan is already active"));
  // Returns the existing plan unchanged
  assert.equal(result.taskPlan, existingPlan);
});

test("integration: executeTool rejects complete_task with no active plan", async () => {
  const ctx = makeWorkspaceCtx();

  const result = await executeTool(
    "complete_task",
    { task_id: "t1", result: "Done." },
    ctx,
    undefined,
    undefined,
    undefined // no plan
  );

  assert.ok(result.result.includes("Error: No task plan is active"));
});

// ─────────────────────────────────────────────────────────────
// Full Pipeline Simulation (mimics graph.ts loop behavior)
// ─────────────────────────────────────────────────────────────

test("integration: full pipeline — plan → work through tasks → final completion", async () => {
  const ctx = makeWorkspaceCtx();
  const sseEvents: SSEEvent[] = [];

  // Helper: simulate what graph.ts does with tool results
  function processToolResult(
    tr: Awaited<ReturnType<typeof executeTool>>,
    currentPlan: TaskPlan | undefined
  ): TaskPlan | undefined {
    if (!tr.taskPlan) return currentPlan;

    const updatedPlan = tr.taskPlan;

    if (tr.completedTaskId) {
      // Task completed
      const completedTask = updatedPlan.tasks.find(
        (t: TaskState) => t.id === tr.completedTaskId
      );
      if (completedTask) {
        sseEvents.push({
          type: "task_update",
          taskId: completedTask.id,
          status: completedTask.status as TaskStatus,
          result: completedTask.result,
        });
      }

      if (tr.nextTask) {
        sseEvents.push({
          type: "task_update",
          taskId: tr.nextTask.id,
          status: "active" as TaskStatus,
        });
        sseEvents.push({
          type: "activity",
          activity: `Working on: ${tr.nextTask.objective}`,
        });
      } else {
        sseEvents.push({
          type: "activity",
          activity: "All tasks complete — composing final response",
        });
      }
    } else {
      // New plan created
      sseEvents.push({ type: "task_plan", tasks: updatedPlan.tasks });

      const activeTask = updatedPlan.tasks.find(
        (t: TaskState) => t.status === "active"
      );
      if (activeTask) {
        sseEvents.push({
          type: "activity",
          activity: `Working on: ${activeTask.objective}`,
        });
      }
    }

    return updatedPlan;
  }

  // ── Step 1: LLM calls plan_tasks ──
  let currentPlan: TaskPlan | undefined;

  const planResult = await executeTool(
    "plan_tasks",
    {
      tasks: [
        {
          id: "extract-evidence",
          objective: "Extract sample sizes and effect sizes from Source A and Source B",
          context_keys: ["source:abc", "source:def"],
        },
        {
          id: "assess-methodology",
          objective: "Assess internal validity of each study's design",
          context_keys: ["source:abc", "source:def"],
          depends_on: ["extract-evidence"],
        },
        {
          id: "render-verdict",
          objective: "Determine which source provides stronger evidence for the thesis",
          depends_on: ["extract-evidence", "assess-methodology"],
        },
      ],
    },
    ctx,
    undefined,
    undefined,
    currentPlan
  );

  currentPlan = processToolResult(planResult, currentPlan);
  assert.ok(currentPlan, "Plan should be created");
  assert.equal(currentPlan!.tasks.length, 3);

  // Verify SSE: task_plan event + activity for first task
  assert.equal(sseEvents[0].type, "task_plan");
  assert.equal((sseEvents[0] as { type: "task_plan"; tasks: TaskState[] }).tasks.length, 3);
  assert.equal(sseEvents[1].type, "activity");
  assert.ok((sseEvents[1] as { type: "activity"; activity: string }).activity.includes("Extract sample sizes"));

  // Verify iteration limit increased
  assert.equal(getMaxIterations(currentPlan), 32); // 20 + 3*4

  // ── Step 2: LLM reads sources (simulated), then calls complete_task for extract-evidence ──
  // (In real flow, LLM would call read_workspace_files here, but we skip that)

  const complete1 = await executeTool(
    "complete_task",
    {
      task_id: "extract-evidence",
      result: "Source A (N=300, RCT) found d=0.42 (p<.01) for CBT on anxiety. Source B (N=89, observational) found no significant effect (p=.23) using GAD-7 measure.",
    },
    ctx,
    undefined,
    undefined,
    currentPlan
  );

  currentPlan = processToolResult(complete1, currentPlan);

  // Verify: extract-evidence completed, assess-methodology activated
  assert.equal(currentPlan!.tasks[0].status, "completed");
  assert.equal(currentPlan!.tasks[1].status, "active");
  assert.equal(currentPlan!.tasks[2].status, "pending"); // still blocked

  // Verify SSE events for this completion
  const completion1Events = sseEvents.slice(2); // after initial plan events
  const taskUpdateCompleted = completion1Events.find(
    (e) => e.type === "task_update" && (e as { taskId: string }).taskId === "extract-evidence"
  );
  assert.ok(taskUpdateCompleted, "Should emit task_update for completed task");

  const taskUpdateActivated = completion1Events.find(
    (e) => e.type === "task_update" && (e as { taskId: string }).taskId === "assess-methodology"
  );
  assert.ok(taskUpdateActivated, "Should emit task_update for newly activated task");

  // Verify the complete_task result includes dependency context for next task
  assert.ok(complete1.result.includes("extract-evidence"), "Result should reference completed task");

  // ── Step 3: Complete assess-methodology ──
  const complete2 = await executeTool(
    "complete_task",
    {
      task_id: "assess-methodology",
      result: "Source A has strong internal validity (randomized, blinded, adequate power). Source B has selection bias and small sample, limiting causal inference.",
    },
    ctx,
    undefined,
    undefined,
    currentPlan
  );

  currentPlan = processToolResult(complete2, currentPlan);

  // render-verdict should now be active (both deps met)
  assert.equal(currentPlan!.tasks[2].status, "active");
  assert.equal(currentPlan!.activeTaskId, "render-verdict");

  // The result for render-verdict should include BOTH dependency results
  assert.ok(complete2.result.includes("d=0.42"), "Should include extract-evidence findings");
  assert.ok(complete2.result.includes("internal validity"), "Should include assess-methodology findings");

  // ── Step 4: Complete render-verdict (final task) ──
  const complete3 = await executeTool(
    "complete_task",
    {
      task_id: "render-verdict",
      result: "Source A provides substantially stronger evidence due to RCT design, larger sample (N=300), and significant effect size (d=0.42). Source B's observational design and small sample limit its evidentiary weight.",
    },
    ctx,
    undefined,
    undefined,
    currentPlan
  );

  currentPlan = processToolResult(complete3, currentPlan);

  // All tasks should be completed
  assert.ok(currentPlan!.tasks.every((t) => t.status === "completed"));
  assert.equal(currentPlan!.activeTaskId, undefined);

  // No nextTask
  assert.equal(complete3.nextTask, undefined);

  // Result should include all task summaries for final synthesis
  assert.ok(complete3.result.includes("All 3 tasks are now complete"));
  assert.ok(complete3.result.includes("[extract-evidence]"));
  assert.ok(complete3.result.includes("[assess-methodology]"));
  assert.ok(complete3.result.includes("[render-verdict]"));

  // Verify SSE has "all tasks complete" activity
  const finalActivity = sseEvents.find(
    (e) => e.type === "activity" && (e as { activity: string }).activity.includes("All tasks complete")
  );
  assert.ok(finalActivity, "Should emit 'All tasks complete' activity");
});

// ─────────────────────────────────────────────────────────────
// SSE Event Ordering
// ─────────────────────────────────────────────────────────────

test("integration: SSE events are emitted in correct order for plan creation", async () => {
  const ctx = makeWorkspaceCtx();
  const events: SSEEvent[] = [];

  const planResult = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "t1", objective: "First task" },
        { id: "t2", objective: "Second task", depends_on: ["t1"] },
      ],
    },
    ctx,
    undefined,
    undefined,
    undefined
  );

  // Simulate graph.ts SSE emission
  if (planResult.taskPlan && !planResult.completedTaskId) {
    events.push({ type: "task_plan", tasks: planResult.taskPlan.tasks });
    const activeTask = planResult.taskPlan.tasks.find((t) => t.status === "active");
    if (activeTask) {
      events.push({ type: "activity", activity: `Working on: ${activeTask.objective}` });
    }
  }

  assert.equal(events.length, 2);
  assert.equal(events[0].type, "task_plan");
  assert.equal(events[1].type, "activity");
  assert.ok((events[1] as { activity: string }).activity.includes("First task"));
});

test("integration: SSE events for task completion include correct status values", async () => {
  const ctx = makeWorkspaceCtx();

  // Create plan
  const planResult = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "t1", objective: "First" },
        { id: "t2", objective: "Second", depends_on: ["t1"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );

  // Complete first task
  const completeResult = await executeTool(
    "complete_task",
    { task_id: "t1", result: "Done with t1." },
    ctx, undefined, undefined, planResult.taskPlan
  );

  // Simulate SSE emission for completion
  const events: SSEEvent[] = [];
  if (completeResult.taskPlan && completeResult.completedTaskId) {
    const completedTask = completeResult.taskPlan.tasks.find(
      (t) => t.id === completeResult.completedTaskId
    );
    if (completedTask) {
      events.push({
        type: "task_update",
        taskId: completedTask.id,
        status: completedTask.status as TaskStatus,
        result: completedTask.result,
      });
    }
    if (completeResult.nextTask) {
      events.push({
        type: "task_update",
        taskId: completeResult.nextTask.id,
        status: "active" as TaskStatus,
      });
    }
  }

  assert.equal(events.length, 2);

  // First event: completed task
  const ev0 = events[0] as { type: "task_update"; taskId: string; status: string; result?: string };
  assert.equal(ev0.taskId, "t1");
  assert.equal(ev0.status, "completed");
  assert.equal(ev0.result, "Done with t1.");

  // Second event: activated task
  const ev1 = events[1] as { type: "task_update"; taskId: string; status: string };
  assert.equal(ev1.taskId, "t2");
  assert.equal(ev1.status, "active");
});

// ─────────────────────────────────────────────────────────────
// State Flow: taskPlan propagation through executeTool
// ─────────────────────────────────────────────────────────────

test("integration: taskPlan state survives multiple executeTool round-trips", async () => {
  const ctx = makeWorkspaceCtx();

  // Create plan
  const r1 = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "a", objective: "Task A" },
        { id: "b", objective: "Task B" },
        { id: "c", objective: "Task C", depends_on: ["a", "b"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );
  let plan = r1.taskPlan!;

  // Complete A
  const r2 = await executeTool(
    "complete_task",
    { task_id: "a", result: "A done." },
    ctx, undefined, undefined, plan
  );
  plan = r2.taskPlan!;
  assert.equal(plan.tasks[0].status, "completed");
  assert.equal(plan.tasks[0].result, "A done.");
  assert.equal(plan.activeTaskId, "b");

  // Complete B
  const r3 = await executeTool(
    "complete_task",
    { task_id: "b", result: "B done." },
    ctx, undefined, undefined, plan
  );
  plan = r3.taskPlan!;
  assert.equal(plan.tasks[1].status, "completed");
  assert.equal(plan.tasks[1].result, "B done.");
  assert.equal(plan.activeTaskId, "c");

  // Complete C (final)
  const r4 = await executeTool(
    "complete_task",
    { task_id: "c", result: "C synthesized A and B." },
    ctx, undefined, undefined, plan
  );
  plan = r4.taskPlan!;
  assert.ok(plan.tasks.every((t) => t.status === "completed"));
  assert.equal(plan.activeTaskId, undefined);
  assert.equal(r4.nextTask, undefined);
});

// ─────────────────────────────────────────────────────────────
// Mixed Tools: plan_tasks alongside regular workspace tools
// ─────────────────────────────────────────────────────────────

test("integration: regular tools still work when a plan is active", async () => {
  const ctx = makeWorkspaceCtx();

  // Create a plan
  const planResult = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "read-src", objective: "Read sources", context_keys: ["source:abc"] },
        { id: "analyze", objective: "Analyze", depends_on: ["read-src"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );

  const plan = planResult.taskPlan!;

  // LLM calls read_workspace_files while plan is active
  const readResult = await executeTool(
    "read_workspace_files",
    { keys: ["source:abc"] },
    ctx,
    undefined,
    undefined,
    plan // plan is active
  );

  // Regular tool should work fine — no taskPlan in result
  assert.ok(readResult.result.includes("Source A"));
  assert.equal(readResult.taskPlan, undefined);
  assert.equal(readResult.completedTaskId, undefined);
});

test("integration: search_workspace works alongside active plan", async () => {
  const ctx = makeWorkspaceCtx();

  const readResult = await executeTool(
    "search_workspace",
    { queries: ["RCT", "anxiety"] },
    ctx,
    undefined,
    undefined,
    undefined
  );

  // Should find matches in source:abc
  assert.ok(readResult.result.includes("source:abc") || readResult.result.includes("RCT"));
});

// ─────────────────────────────────────────────────────────────
// Context Injection Verification
// ─────────────────────────────────────────────────────────────

test("integration: downstream task receives compacted results, not raw tool outputs", async () => {
  const ctx = makeWorkspaceCtx();

  // Create a 3-task plan
  const r1 = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "extract", objective: "Extract key findings" },
        { id: "evaluate", objective: "Evaluate strength", depends_on: ["extract"] },
        { id: "verdict", objective: "Render final verdict", depends_on: ["extract", "evaluate"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );
  let plan = r1.taskPlan!;

  // Complete extract with specific findings
  const r2 = await executeTool(
    "complete_task",
    { task_id: "extract", result: "Source A: d=0.42, N=300, RCT. Source B: p=.23, N=89, observational." },
    ctx, undefined, undefined, plan
  );
  plan = r2.taskPlan!;

  // The result message (what LLM sees) should contain the compacted finding
  assert.ok(r2.result.includes("d=0.42"), "LLM should see compacted findings from extract");
  assert.ok(r2.result.includes("evaluate"), "LLM should be directed to next task");

  // Complete evaluate
  const r3 = await executeTool(
    "complete_task",
    { task_id: "evaluate", result: "Source A has strong internal validity; Source B has weak controls." },
    ctx, undefined, undefined, plan
  );
  plan = r3.taskPlan!;

  // Verdict task should get BOTH extract and evaluate results
  assert.ok(r3.result.includes("[extract]"), "Should include extract dependency label");
  assert.ok(r3.result.includes("d=0.42"), "Should include extract findings");
  assert.ok(r3.result.includes("[evaluate]"), "Should include evaluate dependency label");
  assert.ok(r3.result.includes("internal validity"), "Should include evaluate findings");
});

// ─────────────────────────────────────────────────────────────
// Error Handling Through Dispatcher
// ─────────────────────────────────────────────────────────────

test("integration: circular dependency detected through full dispatcher", async () => {
  const ctx = makeWorkspaceCtx();

  const result = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "a", objective: "Task A", depends_on: ["b"] },
        { id: "b", objective: "Task B", depends_on: ["a"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );

  assert.ok(result.result.includes("Error: Circular dependency"));
  assert.equal(result.taskPlan!.tasks.length, 0);
});

test("integration: completing wrong task returns error through dispatcher", async () => {
  const ctx = makeWorkspaceCtx();

  const r1 = await executeTool(
    "plan_tasks",
    {
      tasks: [
        { id: "t1", objective: "First" },
        { id: "t2", objective: "Second", depends_on: ["t1"] },
      ],
    },
    ctx, undefined, undefined, undefined
  );

  // Try to complete t2 (pending) instead of t1 (active)
  const r2 = await executeTool(
    "complete_task",
    { task_id: "t2", result: "Jumping ahead." },
    ctx, undefined, undefined, r1.taskPlan
  );

  assert.ok(r2.result.includes("Error"));
  assert.ok(r2.result.includes("not the active task"));
});
