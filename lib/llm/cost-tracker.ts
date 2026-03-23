// ─── Cost Tracker ──────────────────────────────────────────────────────────

/** Per-million-token pricing for models used in the pipeline */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.50, output: 3.00 },
  "google/gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.50 },
  "google/gemini-3.1-pro": { input: 2.50, output: 15.00 },
  "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "anthropic/claude-sonnet-4": { input: 3.00, output: 15.00 },
  "anthropic/claude-sonnet-4.6": { input: 3.00, output: 15.00 },
  "openai/gpt-5.4": { input: 2.50, output: 10.00 },
  "gpt-5.4": { input: 2.50, output: 10.00 },
  "gpt-5.4-mini": { input: 0.50, output: 2.00 },
};

interface ModelUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

interface CostSnapshot {
  byModel: Record<string, ModelUsage>;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
}

class CostTracker {
  private usage: Record<string, ModelUsage> = {};

  record(model: string, inputTokens: number, outputTokens: number) {
    if (!this.usage[model]) {
      this.usage[model] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
        totalCostUsd: 0,
      };
    }

    const pricing = MODEL_PRICING[model] ?? { input: 0.50, output: 3.00 };
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;

    const u = this.usage[model];
    u.calls++;
    u.inputTokens += inputTokens;
    u.outputTokens += outputTokens;
    u.inputCostUsd += inputCost;
    u.outputCostUsd += outputCost;
    u.totalCostUsd += inputCost + outputCost;
  }

  snapshot(): CostSnapshot {
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCalls = 0;

    for (const u of Object.values(this.usage)) {
      totalCost += u.totalCostUsd;
      totalInput += u.inputTokens;
      totalOutput += u.outputTokens;
      totalCalls += u.calls;
    }

    return {
      byModel: { ...this.usage },
      totalCostUsd: totalCost,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCalls,
    };
  }

  reset() {
    this.usage = {};
  }
}

export const costTracker = new CostTracker();
