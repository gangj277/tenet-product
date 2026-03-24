export function buildSourceDigestPrompt(): string {
  return `You are digesting one research source for a research-initialization pipeline.

Your job:
1. Read the entire source text provided.
2. Identify the source's meaningful claims relevant to the research perspective.
3. Merge nearby details into coherent source-level claims instead of emitting many atomic fragments.
4. Preserve caveats, limitations, and methodology concerns.
5. Assign a short normalized claimSignature to each claim so that similar claims from different sources can be grouped later.

Rules:
- This is INTRA-SOURCE analysis only. Do not compare against other sources.
- Keep only meaningful claims that materially affect the research question.
- A quantitative detail should support a larger claim, not become its own separate claim unless it is independently important.
- claimSignature should be short, stable, lowercase, and hyphenated.
- Every claim must include at least one citation grounded in the provided text.
- Always include every schema field. If a claim has no natural subquestion, return an empty string. If a citation has no short verbatim quote, return an empty string for quote.
- Return concise arrays. Avoid near-duplicate claims.

Output valid JSON matching the schema provided.`;
}

export function buildSourceWindowNotesPrompt(): string {
  return `You are extracting partial source notes from one bounded window of a longer research source.

Your job:
1. Extract the meaningful claims present in this window.
2. Preserve limitations and methodology issues mentioned in the window.
3. Assign short normalized claimSignature values so overlapping windows can be merged later.
4. Keep claims source-local. Do not decide global importance.

Rules:
- This is PARTIAL source analysis. The full source may contain additional context elsewhere.
- Merge nearby supporting details into coherent claims rather than many atomic fragments.
- Every claim must include at least one citation grounded in the provided window text.
- claimSignature should be short, stable, lowercase, and hyphenated.
- Always include every schema field. If a claim has no natural subquestion, return an empty string. If a citation has no short verbatim quote, return an empty string for quote.

Output valid JSON matching the schema provided.`;
}

export function buildSourceDigestMergePrompt(): string {
  return `You are merging partial notes from multiple windows of the SAME source into one final source digest.

Your job:
1. Merge overlapping window claims into source-level claims.
2. Preserve real within-source tensions, caveats, and limitations.
3. Remove duplicates caused by overlapping windows or paraphrases.
4. Keep citations from the strongest supporting notes.

Rules:
- This is still INTRA-SOURCE analysis only.
- Do not compare or reconcile across different sources.
- claimSignature should stay stable and grouping-friendly.
- Return a compact but meaningful digest of what this source says.
- Always include every schema field. If a claim has no natural subquestion, return an empty string. If a citation has no short verbatim quote, return an empty string for quote.

Output valid JSON matching the schema provided.`;
}
