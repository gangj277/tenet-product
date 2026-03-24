import type { InitRunState, InitRunUpdate, Perspective } from "../state";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL_INTENT } from "@/lib/llm/models";
import { buildPerspectiveInferencePrompt } from "../prompts/perspective-inference";

const PERSPECTIVE_SCHEMA = {
  name: "perspective",
  schema: {
    type: "object",
    properties: {
      projectTitle: { type: "string", description: "A short, concise project title (3-8 words) that captures the research topic. Should read like a workspace name, not a question." },
      briefSummary: { type: "string", description: "A concise summary of the research project" },
      interpretedIntent: { type: "string", description: "What the researcher is trying to achieve" },
      inferredResearchFrame: { type: "string", description: "The inferred analytical frame or hypothesis" },
      evidenceForCriteria: {
        type: "array",
        items: { type: "string" },
        description: "Types of evidence that would support the hypothesis",
      },
      evidenceAgainstCriteria: {
        type: "array",
        items: { type: "string" },
        description: "Types of evidence that would challenge the hypothesis",
      },
      subquestions: {
        type: "array",
        items: { type: "string" },
        description: "Key sub-questions the research should address",
      },
    },
    required: [
      "projectTitle",
      "briefSummary",
      "interpretedIntent",
      "inferredResearchFrame",
      "evidenceForCriteria",
      "evidenceAgainstCriteria",
      "subquestions",
    ],
    additionalProperties: false,
  },
} as const;

export async function inferUserPerspective(
  state: InitRunState
): Promise<InitRunUpdate> {
  try {
    const systemPrompt = buildPerspectiveInferencePrompt();
    const userContent = JSON.stringify(state.input, null, 2);

    const { data } = await callLLMJson<Perspective>({
      model: MODEL_INTENT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      maxTokens: 4096,
      jsonSchema: PERSPECTIVE_SCHEMA,
    });

    return {
      perspective: data,
      currentStep: "infer_user_perspective",
    };
  } catch (err) {
    return {
      errors: [
        {
          step: "infer_user_perspective",
          message: (err as Error).message,
          retryable: true,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
