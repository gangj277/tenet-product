import assert from "node:assert/strict";
import test from "node:test";

import {
  completeActiveProcessTrace,
  failActiveProcessTrace,
  recordProcessActivity,
  recordToolCallTrace,
} from "../app/dashboard/[runId]/_lib/agent-process-trace.ts";

test("recordToolCallTrace summarizes file reads with readable labels", () => {
  const trace = recordToolCallTrace(
    [],
    "read_workspace_files",
    { keys: ["overview", "claims", "source:paper-1"] },
    {
      overview: "Overview",
      claims: "Claims",
      "source:paper-1": "Chen 2025",
    }
  );

  assert.equal(trace.length, 1);
  assert.equal(trace[0].label, "Reading files");
  assert.equal(trace[0].detail, "Overview, Claims, Chen 2025");
  assert.equal(trace[0].status, "active");
});

test("recordToolCallTrace completes the prior active step before starting the next one", () => {
  const initial = recordToolCallTrace(
    [],
    "read_workspace_files",
    { keys: ["overview"] },
    { overview: "Overview" }
  );

  const next = recordToolCallTrace(
    initial,
    "search_workspace",
    { queries: ["sample size", "power"], file_keys: ["claims"] },
    { claims: "Claims" }
  );

  assert.equal(next.length, 2);
  assert.equal(next[0].status, "completed");
  assert.equal(next[1].label, "Searching workspace");
  assert.equal(next[1].detail, '"sample size", "power" in Claims');
  assert.equal(next[1].status, "active");
});

test("recordProcessActivity updates active progress and can create a response phase", () => {
  const toolTrace = recordToolCallTrace(
    [],
    "search_external_sources",
    {
      searches: [
        { query: "self efficacy intervention", intent: "find empirical evidence" },
      ],
    },
    {}
  );

  const withProgress = recordProcessActivity(
    toolTrace,
    "Fetching and ranking candidate papers"
  );
  assert.equal(withProgress[0].detail, '"self efficacy intervention"');
  assert.equal(
    withProgress[0].statusLabel,
    "Fetching and ranking candidate papers"
  );

  const completed = completeActiveProcessTrace(withProgress);
  const composing = recordProcessActivity(completed, "Composing response");

  assert.equal(composing.length, 2);
  assert.equal(composing[1].label, "Composing response");
  assert.equal(composing[1].status, "active");
});

test("failActiveProcessTrace marks the active step as failed and preserves the error detail", () => {
  const trace = recordToolCallTrace(
    [],
    "update_existing_file",
    { key: "synthesis", mode: "targeted" },
    { synthesis: "Synthesis" }
  );

  const failed = failActiveProcessTrace(trace, "Exact match not found");

  assert.equal(failed[0].status, "error");
  assert.equal(failed[0].detail, "Synthesis");
  assert.equal(failed[0].statusLabel, "Exact match not found");
});
