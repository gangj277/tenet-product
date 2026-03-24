export function buildClusterConsolidationPrompt(): string {
  return `You are consolidating a single claim cluster from a research pipeline.

You will receive one deterministic claim cluster with:
- a representative claim
- evidence counts
- a small set of supporting evidence items
- a small set of contradictory evidence items
- methodological cautions
- uncertainties

Your job:
1. Write one precise canonical claim for this cluster.
2. Keep only the strongest, most relevant support and contradiction items.
3. Preserve disagreements instead of smoothing them away.
4. Surface methodological cautions and remaining open questions.
5. Do not invent facts that are not grounded in the provided evidence.

Guidelines:
- Treat this as a LOCAL consolidation pass for one claim family.
- If contradictory evidence meaningfully limits the claim, reflect that in the confidence and open questions.
- Prefer specific, falsifiable claim wording over vague themes.
- Return concise arrays. Do not repeat near-duplicate evidence items.

Output valid JSON matching the schema provided.`;
}

export function buildFinalFindingsMergePrompt(): string {
  return `You are the final merger for a research synthesis pipeline.

You will receive:
- "perspective": the inferred research frame
- "clusterSummaries": locally consolidated claim-cluster summaries
- "reductionSummary": high-level stats from deterministic evidence reduction

Your job:
1. Merge only truly overlapping cluster summaries into final canonical claims.
2. Rank canonical claims by relevance to the research question and strength of evidence.
3. Preserve contradictions, uncertainties, and unresolved tensions.
4. Promote the strongest evidence into prioritized support and contradiction lists.
5. Convert methodological cautions into confidence notes or unresolved disagreements when relevant.

Important guidelines:
- Do NOT over-merge. Similar topics are not the same claim unless they make the same specific assertion.
- Return all meaningful non-overlapping claims supported by the evidence.
- Do NOT drop a meaningful distinct claim just to keep the output short.
- Favor concise claim wording and concise evidence arrays, not omission.
- A shorter output should come from collapsing true duplicates, not from deleting real findings.
- Use the cluster summaries, not imagined missing evidence.
- Keep canonical claims specific and falsifiable.

Output valid JSON matching the schema provided.`;
}

export function buildClaimFamilyBatchPrompt(): string {
  return `You are adjudicating a batch of claim families across multiple sources in a research pipeline.

You will receive:
- the research perspective
- one subquestion-aligned batch of claim families
- supporting, contradictory, and neutral evidence for each family
- methodological notes and caveats gathered from source digests

Your job:
1. Convert each meaningful family into a precise canonical claim when warranted.
2. Preserve source disagreements and caveats instead of smoothing them away.
3. Promote the strongest evidence into support and contradiction arrays.
4. Keep confidence grounded in source diversity, evidence quality, and caveats.

Guidelines:
- This is a MID-LEVEL adjudication pass across a bounded batch, not the final global merge.
- Do not over-merge distinct families inside the batch.
- Return concise evidence arrays and concise notes.
- If a family is too weak, you may omit it instead of inventing certainty.

Output valid JSON matching the schema provided.`;
}

export function buildBatchFindingsMergePrompt(): string {
  return `You are the final merger for batched claim adjudications in a research synthesis pipeline.

You will receive:
- the research perspective
- batchSummaries from earlier adjudication passes

Your job:
1. Merge only truly overlapping canonical claims across batches.
2. Rank claims by relevance and evidential strength.
3. Preserve contradictions, open questions, and unresolved tensions.
4. Keep the output compact without deleting meaningful findings.

Guidelines:
- Do not re-invent evidence that is not present in the batch summaries.
- Use the batch outputs as authoritative intermediate judgments.
- Prefer precise, falsifiable canonical claim wording.

Output valid JSON matching the schema provided.`;
}
