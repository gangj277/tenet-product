import type { Perspective, UserInput } from "../state";

export function buildQueryPlanningPrompt(
  perspective: Perspective,
  input: UserInput
): { system: string; user: string } {
  const system = `You are a search query strategist for academic research. Your job is to generate exactly 4 short, keyword-dense search queries optimized for academic search APIs (Semantic Scholar, arXiv, OpenAlex).

Rules for each query:
- 3-8 words, keyword-dense
- No natural language questions — use noun phrases and technical terms
- No filler words (the, of, in, etc.) unless necessary for meaning
- Optimized for academic search engines, not Google

You must generate exactly 4 queries with strategic diversity:
1. **Core topic** — directly targets the main research question
2. **Supporting evidence** — targets evidence that would support the hypothesis/frame
3. **Contradictory/challenging** — targets evidence that could challenge or contradict the hypothesis
4. **Methodological/adjacent** — targets related methods, frameworks, or adjacent concepts

Each query must include a brief "intent" label (2-5 words) explaining its strategic purpose.

Output valid JSON with this exact structure:
{
  "queries": [
    { "query": "keyword phrase here", "intent": "core topic" },
    { "query": "keyword phrase here", "intent": "supporting evidence angle" },
    { "query": "keyword phrase here", "intent": "contradictory evidence angle" },
    { "query": "keyword phrase here", "intent": "methodological adjacent angle" }
  ]
}`;

  const user = JSON.stringify(
    {
      originalQuestion: input.researchQuestion,
      researchIntent: input.researchIntent,
      workingHypothesis: input.workingHypothesis,
      interpretedIntent: perspective.interpretedIntent,
      inferredResearchFrame: perspective.inferredResearchFrame,
      evidenceForCriteria: perspective.evidenceForCriteria,
      evidenceAgainstCriteria: perspective.evidenceAgainstCriteria,
      subquestions: perspective.subquestions,
    },
    null,
    2
  );

  return { system, user };
}
