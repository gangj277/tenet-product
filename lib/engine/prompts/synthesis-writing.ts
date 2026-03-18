export function buildOverviewPrompt(): string {
  return `You are writing the overview.md for a research project. This file orients the reader to what this project is about.

You will receive JSON with: input (user's original question and intent), perspective (inferred research frame), and consolidatedFindings.

Write a markdown document that includes:
1. The original research question
2. The interpreted research objective
3. The inferred research frame or working hypothesis under examination
4. Scope boundaries
5. Source inventory — list all sources with provenance (uploaded vs discovered)

Write in clear, professional research language. Do not use filler. Do not use emoji.
Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildSynthesisPrompt(): string {
  return `You are writing the synthesis.md for a research project. This is THE most important artifact — it is a deliberate research memo, not a summary.

You will receive JSON with: input (user's original question), perspective (inferred research frame), and consolidatedFindings (ranked evidence, contradictions, open questions).

Write a markdown research memo that:
1. Opens by stating the research question and the frame being tested
2. Presents the STRONGEST evidence FOR the frame — with specific citations [Source: filename, section/page]
3. Presents the STRONGEST evidence AGAINST the frame — with specific citations
4. Addresses unresolved tensions and disagreements between sources
5. Notes methodological cautions that materially affect confidence
6. Ends with a calibrated bottom-line takeaway that does NOT overclaim

CRITICAL RULES:
- Every substantive claim must cite a specific source using [Source: filename, section/page]
- Do NOT hide contradictions behind smooth prose
- Do NOT produce a balanced-sounding summary that avoids stating what the evidence actually suggests
- Thin or conflicting evidence must produce explicit uncertainty, not fake confidence
- This should read like reasoned judgment over evidence, not stitched source summaries
- Write for a researcher who needs to understand the state of evidence quickly

Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildClaimsPrompt(): string {
  return `You are writing the claims.md for a research project. This file catalogs the major claims found across sources.

You will receive JSON with consolidated findings including canonical claims.

Write a markdown document that presents each major claim with:
- The claim statement
- Supporting sources (with [Source: filename] citations)
- Contradicting sources if any
- Confidence assessment (high/medium/low with brief justification)

Organize claims from strongest to weakest evidence. Use a consistent structure for each claim.
Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildGapsPrompt(): string {
  return `You are writing the gaps.md for a research project. This file makes uncertainty actionable.

You will receive JSON with consolidated findings including open questions, contradictions, and confidence notes.

Write a markdown document that includes:
1. Unresolved questions — what the evidence does not settle
2. Contradictions — where sources directly disagree
3. Weak evidence areas — claims that rely on thin or low-quality evidence
4. What would change confidence — specific evidence or studies that would materially affect the synthesis

Make uncertainty actionable, not just disclaimed. The researcher should know exactly where the gaps are and what would fill them.
Output ONLY the markdown content. No JSON wrapper.`;
}

export function buildNextStepsPrompt(): string {
  return `You are writing the next-steps.md for a research project. This file tells the researcher what to do next.

You will receive JSON with the full project context (input, perspective, findings, gaps).

Write a markdown document that includes:
1. Concrete follow-up research directions (specific, not vague)
2. Promising hypothesis refinements based on what the evidence suggests
3. Questions worth exploring in the project's agent chat
4. Specific papers, datasets, or methods worth investigating next

The researcher should feel directed, not finished. Each suggestion should be specific enough to act on.
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
