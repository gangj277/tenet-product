/**
 * PDF text extraction via Gemini 2.5 Flash Lite through OpenRouter.
 * Sends the PDF natively — no external parsing service needed.
 */

import { costTracker } from "@/lib/llm/openrouter";
import {
  RetryableRequestError,
  TimeoutError,
  retryAsync,
  withTimeout,
} from "@/lib/utils/async";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const PDF_EXTRACTION_TIMEOUT_MS = 45_000;

const EXTRACTION_PROMPT = `Read this research paper and produce a faithful, condensed representation of it in markdown.

YOUR CORE OBLIGATION: Preserve the paper's complete logical flow. The reader of your output should follow the exact same chain of reasoning as the reader of the original PDF — from motivation through methodology through evidence to conclusions. Nothing added, nothing distorted (왜곡 없이).

You may rephrase for clarity and conciseness, but you must NEVER:
- Change the meaning or emphasis of any claim
- Omit a step in the argument's logical chain
- Alter, round, or paraphrase any quantitative data
- Add your own interpretation or analysis
- Invent section headers like "Summary", "Key Claims", or "Contribution"

You SHOULD:
- Condense verbose or repetitive prose into tighter language while preserving meaning
- Drop generic background that explains well-known concepts (e.g., "Neural networks are...")
- Drop transitions and signposting ("The rest of this paper is organized as follows...")
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

const MAX_RETRIES = 2;

export async function parsePDF(
  buffer: Buffer,
  filename: string,
  options: {
    model?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<ParseResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const pdfBase64 = buffer.toString("base64");

  const model = options.model ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PDF_EXTRACTION_TIMEOUT_MS;
  const retries = options.retries ?? MAX_RETRIES;

  return retryAsync({
    retries,
    shouldRetry: (error) =>
      error instanceof RetryableRequestError ||
      error instanceof TimeoutError ||
      error instanceof TypeError,
    getDelayMs: (attempt) => 1000 * attempt,
    operation: async () => {
      const response = await withTimeout(
        (signal) =>
          fetchImpl(OPENROUTER_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://research-cursor.app",
              "X-OpenRouter-Title": "Research Cursor",
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "file",
                      file: {
                        filename,
                        file_data: `data:application/pdf;base64,${pdfBase64}`,
                      },
                    },
                    { type: "text", text: EXTRACTION_PROMPT },
                  ],
                },
              ],
              temperature: 0,
              max_tokens: 16384,
            }),
            signal,
          }),
        timeoutMs,
        `PDF extraction timed out (${model}) after ${Math.round(timeoutMs / 1000)}s`
      );

      if (!response.ok) {
        const errorBody = await response.text();
        const message =
          `PDF extraction failed (${model}): ${response.status} ${errorBody.slice(0, 300)}`;

        if (response.status === 429 || response.status >= 500) {
          throw new RetryableRequestError(message);
        }

        throw new Error(message);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";

      // Track cost
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      costTracker.record(data.model ?? model, promptTokens, completionTokens);

      if (!text || text.length < 100) {
        throw new Error("PDF extraction returned empty or near-empty result");
      }

      return {
        text,
        pageCount: 0, // Gemini doesn't report page count
      };
    },
  });
}
