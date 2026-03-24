import assert from "node:assert/strict";
import test from "node:test";
import {
  STATUS_MAP,
  groupProjectsByStatus,
} from "../app/dashboard/_lib/project-groups";

test("groupProjectsByStatus keeps drafts out of completed projects", () => {
  const grouped = groupProjectsByStatus([
    {
      id: "project-draft",
      runId: "run-draft",
      title: "Draft workspace",
      status: "draft",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    },
    {
      id: "project-running",
      runId: "run-running",
      title: "Running analysis",
      status: "running",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    },
    {
      id: "project-complete",
      runId: "run-complete",
      title: "Completed analysis",
      status: "completed",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(grouped.drafts.map((project) => project.id), ["project-draft"]);
  assert.deepEqual(grouped.active.map((project) => project.id), ["project-running"]);
  assert.deepEqual(grouped.completed.map((project) => project.id), ["project-complete"]);
  assert.equal(STATUS_MAP.draft.label, "Draft");
});
