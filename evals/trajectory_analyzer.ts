/**
 * Trajectory capture and analysis for the research init pipeline.
 * Traces LLM calls, API calls (Exa, Gemini PDF extraction), and graph node transitions.
 */

export interface TraceStep {
  step: number;
  type: "llm_call" | "tool_call" | "node_transition";
  durationMs: number;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  tool?: string;
  node?: string;
  args?: Record<string, unknown>;
  resultSummary?: string;
  flags: string[];
}

export class Tracer {
  steps: TraceStep[] = [];
  private counter = 0;

  traceLlmCall(
    model: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number
  ): void {
    this.counter++;
    this.steps.push({
      step: this.counter,
      type: "llm_call",
      durationMs,
      model,
      inputTokens,
      outputTokens,
      flags: [],
    });
  }

  traceToolCall(
    tool: string,
    args: Record<string, unknown>,
    result: unknown,
    durationMs: number
  ): void {
    this.counter++;
    const step: TraceStep = {
      step: this.counter,
      type: "tool_call",
      durationMs,
      tool,
      args,
      inputTokens: 0,
      outputTokens: 0,
      resultSummary: String(result).slice(0, 500),
      flags: [],
    };

    for (const prev of this.steps) {
      if (
        prev.type === "tool_call" &&
        prev.tool === tool &&
        JSON.stringify(prev.args) === JSON.stringify(args)
      ) {
        step.flags.push(`duplicate_of_step_${prev.step}`);
      }
    }
    this.steps.push(step);
  }

  traceNodeTransition(node: string, durationMs: number): void {
    this.counter++;
    this.steps.push({
      step: this.counter,
      type: "node_transition",
      durationMs,
      node,
      inputTokens: 0,
      outputTokens: 0,
      flags: [],
    });
  }

  get totalTokens(): number {
    return this.steps.reduce(
      (sum, s) => sum + s.inputTokens + s.outputTokens,
      0
    );
  }

  get totalDurationMs(): number {
    return this.steps.reduce((sum, s) => sum + s.durationMs, 0);
  }

  get llmCalls(): number {
    return this.steps.filter((s) => s.type === "llm_call").length;
  }

  get toolCalls(): number {
    return this.steps.filter((s) => s.type === "tool_call").length;
  }
}

// ─── Analysis ───────────────────────────────────────────────────────────────

interface TrajectoryAnalysis {
  total_steps: number;
  llm_calls: number;
  tool_calls: number;
  node_transitions: number;
  efficiency_score: number;
  loops?: LoopInfo[];
  loop_detected?: boolean;
  redundant_steps?: number;
  tool_distribution?: Record<string, number>;
  node_sequence?: string[];
}

interface LoopInfo {
  type: "exact_repeat" | "sequence_repeat";
  original_step?: number;
  repeated_step?: number;
  steps?: number[];
  tool?: string;
  pattern?: string;
}

export function analyzeTrajectory(
  steps: TraceStep[],
  detectLoops = true,
  analyzeToolSelection = true
): TrajectoryAnalysis {
  const analysis: TrajectoryAnalysis = {
    total_steps: steps.length,
    llm_calls: steps.filter((s) => s.type === "llm_call").length,
    tool_calls: steps.filter((s) => s.type === "tool_call").length,
    node_transitions: steps.filter((s) => s.type === "node_transition").length,
    efficiency_score: efficiencyScore(steps),
    node_sequence: steps
      .filter((s) => s.type === "node_transition" && s.node)
      .map((s) => s.node!),
  };

  if (detectLoops) {
    const loops = findLoops(steps);
    analysis.loops = loops;
    analysis.loop_detected = loops.length > 0;
  }

  if (analyzeToolSelection) {
    analysis.redundant_steps = steps.filter((s) => s.flags.length > 0).length;
    analysis.tool_distribution = toolDistribution(steps);
  }

  return analysis;
}

function efficiencyScore(steps: TraceStep[]): number {
  if (!steps.length) return 1.0;
  const flagged = steps.filter((s) => s.flags.length > 0).length;
  return Math.round((1.0 - flagged / steps.length) * 1000) / 1000;
}

function findLoops(steps: TraceStep[]): LoopInfo[] {
  const loops: LoopInfo[] = [];
  const toolSteps = steps.filter((s) => s.type === "tool_call");
  const seen = new Map<string, number>();

  for (const s of toolSteps) {
    const key = `${s.tool}::${JSON.stringify(s.args)}`;
    if (seen.has(key)) {
      loops.push({
        type: "exact_repeat",
        original_step: seen.get(key)!,
        repeated_step: s.step,
        tool: s.tool,
      });
    } else {
      seen.set(key, s.step);
    }
  }

  return loops;
}

function toolDistribution(steps: TraceStep[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const s of steps) {
    if (s.type === "tool_call" && s.tool) {
      dist[s.tool] = (dist[s.tool] ?? 0) + 1;
    }
  }
  return dist;
}
