import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { InitRunAnnotation } from "./state";

import { intakeUserContext } from "./nodes/intake-user-context";
import { inferUserPerspective } from "./nodes/infer-user-perspective";
import { confirmInferredBrief } from "./nodes/confirm-inferred-brief";
import { planSearchQueries } from "./nodes/plan-search-queries";
import { buildSourceSet } from "./nodes/build-source-set";
import { classifyAndAnalyze } from "./nodes/classify-and-analyze";
import { consolidateFindings } from "./nodes/consolidate-findings";
import { synthesizeProject } from "./nodes/synthesize-project";
import { persistProject } from "./nodes/persist-project";

// ── Route after intake: fail fast or continue ──

function afterIntake(
  state: typeof InitRunAnnotation.State
): typeof END | "infer_user_perspective" {
  if (state.status === "failed") return END;
  return "infer_user_perspective";
}

// ── Build the graph ──

const globalForInitGraph = globalThis as typeof globalThis & {
  __tenetInitGraphCheckpointer?: MemorySaver;
};

function getInitGraphCheckpointer() {
  return (
    globalForInitGraph.__tenetInitGraphCheckpointer ??
    (globalForInitGraph.__tenetInitGraphCheckpointer = new MemorySaver())
  );
}

function buildInitGraph() {
  const graph = new StateGraph(InitRunAnnotation)
    // Nodes
    .addNode("intake_user_context", intakeUserContext)
    .addNode("infer_user_perspective", inferUserPerspective)
    .addNode("confirm_inferred_brief", confirmInferredBrief)
    .addNode("plan_search_queries", planSearchQueries)
    .addNode("build_source_set", buildSourceSet)
    .addNode("classify_and_analyze", classifyAndAnalyze)
    .addNode("consolidate_findings", consolidateFindings)
    .addNode("synthesize_project", synthesizeProject)
    .addNode("persist_project", persistProject)

    // Edges
    .addEdge(START, "intake_user_context")
    .addConditionalEdges("intake_user_context", afterIntake)
    .addEdge("infer_user_perspective", "confirm_inferred_brief")
    .addEdge("confirm_inferred_brief", "plan_search_queries")
    .addEdge("plan_search_queries", "build_source_set")
    .addEdge("build_source_set", "classify_and_analyze")
    .addEdge("classify_and_analyze", "consolidate_findings")
    .addEdge("consolidate_findings", "synthesize_project")
    .addEdge("synthesize_project", "persist_project")
    .addEdge("persist_project", END);

  const checkpointer = getInitGraphCheckpointer();
  return graph.compile({ checkpointer });
}

export const initGraph = buildInitGraph();
