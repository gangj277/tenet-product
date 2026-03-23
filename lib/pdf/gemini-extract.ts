/**
 * PDF text extraction: local pdfjs-dist extraction → LLM normalization.
 * Works with any LLM provider (Codex, OpenRouter, etc.) via callLLM.
 */

import { callLLM } from "@/lib/llm/openrouter";

export const EXTRACTION_PROMPT = `Read this extracted text from a research paper and produce a faithful, condensed representation of it in markdown.

YOUR CORE OBLIGATION: Preserve the paper's complete logical flow. The reader of your output should follow the exact same chain of reasoning as the reader of the original — from motivation through methodology through evidence to conclusions. Nothing added, nothing distorted.

You may rephrase for clarity and conciseness, but you must NEVER:
- Change the meaning or emphasis of any claim
- Omit a step in the argument's logical chain
- Alter, round, or paraphrase any quantitative data
- Add your own interpretation or analysis
- Invent section headers like "Summary", "Key Claims", or "Contribution"

You SHOULD:
- Condense verbose or repetitive prose into tighter language while preserving meaning
- Drop generic background that explains well-known concepts
- Drop transitions and signposting
- Drop bibliography list, acknowledgments, author bios, copyright notices
- Keep the paper's own section structure as markdown headings

WHAT MUST BE PRESERVED:
- The complete argument chain: question → hypothesis → method → evidence → interpretation → conclusion
- Every step of reasoning that connects one claim to the next
- ALL quantitative data exactly as written: numbers, p-values, effect sizes, CIs, sample sizes, metrics
- ALL results including null, negative, and unexpected findings
- ALL limitations, caveats, and boundary conditions the authors state
- Key comparisons to prior work with citation markers preserved exactly (e.g., [1], [Smith et al., 2024])
- Tables (in markdown format), equations (in LaTeX), and figure captions that contain data

Think of it this way: if someone read only your output and then described the paper's argument, they should get it exactly right — same claims, same evidence, same caveats, same logical structure. Just shorter and cleaner.`;

export interface ParseResult {
  text: string;
  pageCount: number;
}

/**
 * Extract raw text from a PDF buffer using pdfjs-dist (local, no API needed).
 */
async function extractRawText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // Dynamic import to avoid bundling issues
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = doc.numPages;

  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str ?? "")
      .join(" ");
    pages.push(pageText);
  }

  await doc.destroy();
  return { text: pages.join("\n\n"), pageCount };
}

/**
 * Parse a PDF: extract text locally, then normalize via the active LLM provider.
 * Uses whatever provider is set (Codex, OpenRouter, etc.) through callLLM.
 */
export async function parsePDF(
  buffer: Buffer,
  filename: string,
  options: {
    model?: string;
    // Legacy options kept for compat but no longer used
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<ParseResult> {
  // Step 1: Extract raw text locally via pdfjs-dist
  const { text: rawText, pageCount } = await extractRawText(buffer);

  if (!rawText || rawText.trim().length < 50) {
    throw new Error(`PDF extraction returned minimal text for "${filename}" (${rawText.length} chars)`);
  }

  // Step 2: Normalize via LLM (uses request-scoped provider if set, else server default)
  // Truncate to ~30k chars to stay within context limits
  const truncated = rawText.slice(0, 30000);

  const response = await callLLM({
    model: options.model ?? "google/gemini-2.5-flash-lite", // maps to gpt-5.4-mini for Codex users
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      {
        role: "user",
        content: `[Source: ${filename}]\n\n${truncated}`,
      },
    ],
    temperature: 0,
    maxTokens: 16384,
  });

  if (!response.content || response.content.length < 100) {
    throw new Error("LLM normalization returned empty or near-empty result");
  }

  return {
    text: response.content,
    pageCount,
  };
}
