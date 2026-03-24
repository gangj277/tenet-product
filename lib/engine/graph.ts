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

// ── Route after each node: fail fast or continue ──

function continueOrEnd<T extends string>(nextNode: T) {
  return (state: typeof InitRunAnnotation.State): typeof END | T => {
    if (state.status === "failed") return END;
    return nextNode;
  };
}

// ── Build the graph ──

const globalForInitGraph = globalThis as typeof globalThis & {
  __lumenInitGraphCheckpointer?: MemorySaver;
};

function getInitGraphCheckpointer() {
  return (
    globalForInitGraph.__lumenInitGraphCheckpointer ??
    (globalForInitGraph.__lumenInitGraphCheckpointer = new MemorySaver())
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
    .addConditionalEdges(
      "intake_user_context",
      continueOrEnd("infer_user_perspective")
    )
    .addConditionalEdges(
      "infer_user_perspective",
      continueOrEnd("confirm_inferred_brief")
    )
    .addConditionalEdges(
      "confirm_inferred_brief",
      continueOrEnd("plan_search_queries")
    )
    .addConditionalEdges(
      "plan_search_queries",
      continueOrEnd("build_source_set")
    )
    .addConditionalEdges(
      "build_source_set",
      continueOrEnd("classify_and_analyze")
    )
    .addConditionalEdges(
      "classify_and_analyze",
      continueOrEnd("consolidate_findings")
    )
    .addConditionalEdges(
      "consolidate_findings",
      continueOrEnd("synthesize_project")
    )
    .addConditionalEdges(
      "synthesize_project",
      continueOrEnd("persist_project")
    )
    .addEdge("persist_project", END);

  const checkpointer = getInitGraphCheckpointer();
  return graph.compile({ checkpointer });
}

export const initGraph = buildInitGraph();
