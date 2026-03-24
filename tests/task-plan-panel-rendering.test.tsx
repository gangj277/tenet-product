import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("task plan panel renders a flat completed-count summary with the checklist visible", async () => {
  const panelModule = await import(
    "../app/dashboard/[runId]/_components/chat/task-plan-panel.tsx"
  );

  const TaskPlanPanel =
    panelModule.TaskPlanPanel ?? panelModule.default.TaskPlanPanel;

  const html = renderToStaticMarkup(
    <TaskPlanPanel
      tasks={[
        {
          id: "task-1",
          objective:
            "Reproduce the token-counting mismatch with focused tests around provider usage versus next-turn live context",
          status: "pending",
        },
        {
          id: "task-2",
          objective:
            "Add a diagnostic script that can run real agent/provider inference and print raw Responses API usage plus local estimates",
          status: "pending",
        },
        {
          id: "task-3",
          objective:
            "Implement the minimal counting fix based on the evidence and keep provider usage separate from live-context estimation",
          status: "pending",
        },
        {
          id: "task-4",
          objective: "Run targeted verification for tests and script behavior",
          status: "pending",
        },
      ]}
      onDismiss={() => {}}
    />
  );

  assert.match(html, /0 out of 4 tasks completed/i);
  assert.match(html, /Reproduce the token-counting mismatch/i);
  assert.match(html, /Add a diagnostic script/i);
  assert.match(html, /Implement the minimal counting fix/i);
  assert.match(html, /Run targeted verification/i);
});
