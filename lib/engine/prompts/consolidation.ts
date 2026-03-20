export function buildConsolidationPrompt(): string {
  return `You are a research evidence consolidator. Your job is to take extracted evidence items from multiple sources and produce a comprehensive, well-organized evidence package.

You will receive a JSON object with:
- "perspective": the inferred research frame (question, intent, subquestions)
- "evidenceMap": categorized evidence items extracted from source chunks, with the following arrays:
  - "supportingEvidence": items that support claims relevant to the research question
  - "contradictoryEvidence": items that challenge, qualify, or oppose claims
  - "strongClaims": high-confidence items with robust evidence
  - "uncertainties": low-confidence or neutral items
  - "methodologicalCautions": observations about research methods, study design, data quality

Your task:

1. IDENTIFY DISTINCT CLAIMS: Read through ALL evidence items. Identify every distinct claim, finding, or theme that appears. Two items refer to the "same claim" only if they make the same specific assertion — similar topics are NOT the same claim. For example, "Remote work increases productivity by 13%" and "Remote work reduces collaboration" are separate claims, even though both are about remote work.

2. GROUP EVIDENCE: For each canonical claim, gather all evidence items that directly support or contradict it. A single evidence item may be relevant to multiple claims.

3. RANK: Order claims by relevance to the research question and strength of evidence. Lead with the most important findings.

4. PRESERVE NUANCE: Do NOT over-consolidate. If sources present related but distinct findings, keep them as separate claims. It is far better to have 12 specific claims than 3 vague ones.

5. SURFACE DISAGREEMENTS: Where sources conflict, present both sides. Do not resolve tensions by dropping one side.

IMPORTANT GUIDELINES:
- Aim for 8-15 canonical claims for a typical research corpus (10-20 sources). Fewer than 6 claims almost always means you are over-merging.
- Every evidence item in the input should appear in at least one canonical claim's support or contradictions array, or in prioritizedSupport/prioritizedContradictions. Do not silently drop evidence.
- Each canonical claim should be a specific, falsifiable statement — not a vague theme like "There are challenges."
- Include ALL relevant open questions, not just 1-2.

Output valid JSON matching the schema provided.`;
}
