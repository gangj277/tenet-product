/**
 * Test: PDF extraction via OpenRouter — compare models.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { resolve, basename } from "path";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  // "google/gemini-2.5-flash-lite",
  // "openai/gpt-5-nano",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

const PDF_PATH = resolve(
  __dirname,
  "../../fixtures/project-init/ai-model-collapse/pdfs/01-curse-of-recursion.pdf"
);

const EXTRACTION_PROMPT = `Extract ALL text content from this academic research paper and output it as well-structured markdown.

Requirements:
1. Preserve the complete section hierarchy using markdown headings (# for title, ## for sections, ### for subsections)
2. Preserve all in-text citations exactly as they appear (e.g., [1], [Smith et al., 2024])
3. Convert mathematical formulas to LaTeX notation using $ (inline) or $$ (block)
4. Preserve tables using markdown table syntax
5. Keep figure captions with their figure numbers
6. Include the full references/bibliography section
7. Maintain the reading order (left column then right column for two-column layouts)
8. Do NOT summarize or skip any content — extract EVERYTHING

Output ONLY the extracted markdown text. No commentary.`;

async function testModel(model: string, pdfBase64: string, apiKey: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  MODEL: ${model}`);
  console.log(`${"═".repeat(60)}`);

  const start = Date.now();

  const response = await fetch(OPENROUTER_URL, {
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
                filename: basename(PDF_PATH),
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 32768,
    }),
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`  ERROR ${response.status}: ${errorBody.slice(0, 300)}`);
    return null;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {};

  // Quality checks
  const sections = (text.match(/^##\s+.+/gm) || []).length;
  let citations = 0;
  for (const p of [/\[\d+\]/g, /\[[A-Z][^\]]*et al[^\]]*\]/g, /\([A-Z][a-z]+ et al\.[^)]*\)/g]) {
    citations += (text.match(p) || []).length;
  }

  const results = {
    model: data.model ?? model,
    latencyS: (latencyMs / 1000).toFixed(1),
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    chars: text.length,
    sections,
    citations,
    hasRefs: /references|bibliography/i.test(text),
    hasTables: /\|.*\|.*\|/m.test(text),
    hasMath: /\$[^$]+\$/.test(text),
  };

  // OpenRouter pricing per model ($/M tokens)
  const PRICING: Record<string, { input: number; output: number }> = {
    "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
    "google/gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.50 },
    "openai/gpt-5-nano": { input: 0.05, output: 0.40 },
    "openai/gpt-oss-120b": { input: 0.039, output: 0.19 },
    "openai/gpt-oss-20b": { input: 0.03, output: 0.14 },
    "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  };
  const pricing = PRICING[model] ?? { input: 0.10, output: 0.40 };
  const inputCost = results.inputTokens * pricing.input / 1_000_000;
  const outputCost = results.outputTokens * pricing.output / 1_000_000;
  const totalCost = inputCost + outputCost;

  console.log(`  Time:       ${results.latencyS}s`);
  console.log(`  Tokens:     ${results.inputTokens} in / ${results.outputTokens} out`);
  console.log(`  Text:       ${results.chars} chars`);
  console.log(`  Sections:   ${results.sections}`);
  console.log(`  Citations:  ${results.citations}`);
  console.log(`  References: ${results.hasRefs ? "YES" : "NO"}`);
  console.log(`  Tables:     ${results.hasTables ? "YES" : "NO"}`);
  console.log(`  Math/LaTeX: ${results.hasMath ? "YES" : "NO"}`);
  console.log(`  Est. cost:  $${totalCost.toFixed(6)}`);

  // Save output
  const outDir = resolve(__dirname, "../evals/results/pdf-extraction-test");
  await mkdir(outDir, { recursive: true });
  const slug = model.replace(/\//g, "_");
  await writeFile(resolve(outDir, `${slug}.md`), text);

  // Preview
  console.log(`\n  ─── Preview (first 1000 chars) ───`);
  console.log(text.slice(0, 1000));
  console.log(`  ─── End ───`);

  return { ...results, totalCost };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.error("OPENROUTER_API_KEY not set"); process.exit(1); }

  console.log(`PDF: ${basename(PDF_PATH)}`);
  const pdfBuffer = await readFile(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString("base64");
  console.log(`Size: ${(pdfBuffer.length / 1024).toFixed(0)} KB`);

  const results = [];
  for (const model of MODELS) {
    const r = await testModel(model, pdfBase64, apiKey);
    if (r) results.push(r);
  }

  // Summary table
  console.log(`\n\n${"═".repeat(60)}`);
  console.log("  COMPARISON SUMMARY");
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${"Model".padEnd(40)} ${"Time".padEnd(8)} ${"Chars".padEnd(8)} ${"Cost".padEnd(10)}`);
  for (const r of results) {
    console.log(`  ${r.model.padEnd(40)} ${(r.latencyS + "s").padEnd(8)} ${String(r.chars).padEnd(8)} $${r.totalCost.toFixed(6)}`);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
