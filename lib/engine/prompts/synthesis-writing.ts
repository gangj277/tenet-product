export function buildOverviewPrompt(): string {
  return `You are writing the overview.md artifact for a research project.

Goal: orient the researcher in under 250 words.

You will receive shared project JSON with:
- input
- perspective
- consolidatedFindings
- sourceBase

Write concise markdown using EXACTLY these headings:
# Overview
## In Brief
## Frame
## Scope
## Source Base

Rules:
- Be compact, direct, and readable on first pass.
- Prefer 1 short paragraph per section.
- In "Source Base", summarize the corpus by counts and provenance. Do NOT list every source.
- Mention only the most decision-relevant claim headlines.
- Do not use filler, throat-clearing, or emoji.

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildSynthesisPrompt(): string {
  return `You are writing the synthesis.md artifact for a research project.

Goal: deliver reasoned judgment quickly without overwhelming the researcher.

You will receive shared project JSON with:
- input
- perspective
- consolidatedFindings
- sourceBase

Write concise markdown using EXACTLY these headings:
# Synthesis
## Bottom Line
## What Supports It
## What Weakens It
## What Remains Unresolved
## Confidence

Rules:
- Keep the full document under about 1,200 words.
- Write for a researcher who needs the answer quickly.
- The Bottom Line should be 2 short paragraphs max.
- Use bullets in the evidence sections. Max 4 bullets per section.
- Each bullet should be 2-4 sentences and should synthesize evidence, not dump notes.
- Every substantive claim must cite a specific source using [Source: filename, section/page].
- Do NOT hide contradictions behind smooth prose.
- Do NOT overclaim when evidence is thin, indirect, or conflicting.
- Do NOT repeat the same point across sections.

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildClaimsPrompt(): string {
  return `You are writing the claims.md artifact for a research project.

This file is a complete distinct claims inventory, not a top-N highlight list.

You will receive shared project JSON with:
- input
- perspective
- consolidatedFindings
- sourceBase

Write concise markdown using this structure:
# Key Claims

Then repeat this compact pattern for each claim:
## Claim N
**Claim:** one-sentence claim statement
**Evidence:** one short line summarizing strongest support with citations
**Limitation:** one short line summarizing contradiction or caveat with citations, if present
**Confidence:** high/medium/low with one brief reason

Rules:
- Include all meaningful non-overlapping canonical claims.
- Do not drop a meaningful claim just to stay concise.
- Keep entries terse by collapsing true duplicates and compressing phrasing.
- Order claims by decision relevance and evidence strength.
- Do not repeat near-identical evidence across claims.
- Every evidence or limitation line must cite sources using [Source: filename, section/page] or [Source: filename].

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildGapsPrompt(): string {
  return `You are writing the gaps.md artifact for a research project.

Goal: turn uncertainty into a short action map.

You will receive shared project JSON with:
- input
- perspective
- consolidatedFindings
- sourceBase

Write concise markdown using EXACTLY these headings:
# Gaps
## What The Evidence Does Not Settle
## Where Evidence Is Thin
## What Would Change The Answer

Rules:
- Use bullets, not long paragraphs.
- Max 5 bullets per section.
- Each bullet should be concrete and actionable.
- Do not repeat the same uncertainty in multiple sections.

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildNextStepsPrompt(): string {
  return `You are writing the next-steps.md artifact for a research project.

Goal: leave the researcher with a short, prioritized action list.

You will receive shared project JSON with:
- input
- perspective
- consolidatedFindings
- sourceBase

Write concise markdown using EXACTLY these headings:
# Next Steps

Then produce 4-6 concrete next actions.

Rules:
- Each action should have a short title plus 1-2 sentences of rationale.
- Prefer high-leverage follow-ups over generic advice.
- Turn uncertainty into specific research actions, hypothesis refinements, source searches, or evaluation tasks.
- Keep the document direct and skimmable.

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildSourceSummaryPrompt(): string {
  return `You are writing a per-source summary for a research project. This file helps the researcher understand what one specific source contributes.

You will receive JSON with: sourceName, content (the parsed text), and perspective (the research frame).

Write a markdown document that includes:
1. Document metadata (title, publication info if available)
2. A concise summary of the source's main argument or findings (3-5 sentences)
3. Key claims extracted from this source (bullet list)
4. Relevant evidence or quotes that matter for the synthesis
5. How this source contributes to or challenges the research frame

Output ONLY the markdown content. No JSON wrapper.`;
}
