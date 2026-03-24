import type { InitRunState, InitRunUpdate, SearchQueryPlan } from "../state";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL } from "@/lib/llm/models";
import { buildQueryPlanningPrompt } from "../prompts/query-planning";

const SEARCH_QUERY_PLAN_SCHEMA = {
  name: "search_query_plan",
  schema: {
    type: "object",
    properties: {
      queries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            query: { type: "string", description: "Short keyword-dense search query (3-8 words)" },
            intent: { type: "string", description: "Brief label for the query's strategic purpose" },
          },
          required: ["query", "intent"],
          additionalProperties: false,
        },
        minItems: 5,
        maxItems: 6,
        description: "5-6 strategically diverse search queries",
      },
    },
    required: ["queries"],
    additionalProperties: false,
  },
} as const;

export async function planSearchQueries(
  state: InitRunState
): Promise<InitRunUpdate> {
  if (!state.perspective) {
    return {
      currentStep: "plan_search_queries",
      errors: [
        {
          step: "plan_search_queries",
          message: "No perspective available to plan queries from",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  try {
    const { system, user } = buildQueryPlanningPrompt(
      state.perspective,
      state.input
    );

    const { data } = await callLLMJson<SearchQueryPlan>({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      maxTokens: 1024,
      jsonSchema: SEARCH_QUERY_PLAN_SCHEMA,
    });

    return {
      searchQueryPlan: data,
      currentStep: "plan_search_queries",
    };
  } catch (err) {
    console.error("[plan-search] Error:", (err as Error).message);
    return {
      currentStep: "plan_search_queries",
      errors: [
        {
          step: "plan_search_queries",
          message: (err as Error).message,
          retryable: true,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
