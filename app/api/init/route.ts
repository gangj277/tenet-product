import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils/id";
import { initGraph } from "@/lib/engine/graph";
import { memoryStore } from "@/lib/storage/memory-store";
import type { UserInput, SourceEntry } from "@/lib/engine/state";
import { getSession } from "@/lib/auth/session";
import {
  createResearchProjectRun,
  updateResearchRunStatus,
} from "@/lib/db/research-projects";
import { costTracker, setRequestProvider, clearRequestProvider } from "@/lib/llm/openrouter";
import { checkUserBudget, recordUserCost } from "@/lib/rate-limit";
import { createProviderForUser } from "@/lib/llm/provider-factory";

export const maxDuration = 300;

interface InitRequestBody {
  input: UserInput;
  sources?: SourceEntry[];
}

export async function POST(request: NextRequest) {
  let projectId: string | null = null;
  let runId: string | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve user's LLM provider (Codex OAuth or OpenRouter fallback)
    let provider;
    try {
      provider = await createProviderForUser(session.userId);
    } catch {
      // Fall back to server default if no user provider configured
      provider = null;
    }

    // Per-user daily cost budget check (skip for Codex users)
    if (!provider || provider.kind !== "codex") {
      const budgetCheck = checkUserBudget(session.userId);
      if (!budgetCheck.allowed) {
        return NextResponse.json(
          {
            error: `Daily usage limit reached ($${budgetCheck.spentUsd.toFixed(2)}/$${budgetCheck.limitUsd}). Resets at midnight UTC.`,
          },
          { status: 429 }
        );
      }
    }

    const body = (await request.json()) as InitRequestBody;

    if (!body.input?.researchQuestion?.trim()) {
      return NextResponse.json(
        { error: "researchQuestion is required" },
        { status: 400 }
      );
    }

    projectId = generateId();
    runId = generateId();
    const threadId = runId; // 1:1 mapping for simplicity

    await createResearchProjectRun({
      projectId,
      runId,
      userId: session.userId,
      input: body.input,
      status: "running",
    });

    memoryStore.setRun(runId, {
      projectId,
      runId,
      status: "running",
      updatedAt: new Date().toISOString(),
    });

    const config = { configurable: { thread_id: threadId } };
    const costBefore = costTracker.snapshot().totalCostUsd;

    // Set request-scoped provider so all engine nodes use the user's provider
    if (provider) setRequestProvider(provider);

    let result;
    try {
      // Invoke graph — it will run until the interrupt at confirm_inferred_brief
      result = await initGraph.invoke(
        {
          projectId,
          runId,
          userId: session.userId,
          status: "queued",
          input: body.input,
          sources: body.sources ?? [],
        },
        config
      );
    } finally {
      clearRequestProvider();
    }

    // Record cost for this request
    const costAfter = costTracker.snapshot().totalCostUsd;
    if (!provider || provider.kind !== "codex") {
      recordUserCost(session.userId, costAfter - costBefore);
    }

    // After invoke returns due to interrupt, update run status
    memoryStore.setRun(runId, {
      projectId,
      runId,
      status: "awaiting_confirmation",
      updatedAt: new Date().toISOString(),
    });

    await updateResearchRunStatus({
      projectId,
      runId,
      status: "awaiting_confirmation",
    });

    return NextResponse.json({
      runId,
      projectId,
      status: "awaiting_confirmation",
      perspective: result.perspective,
    });
  } catch (err) {
    // Check if this is a graph interrupt (expected behavior)
    const error = err as { name?: string; interrupts?: unknown[] };
    if (error.name === "GraphInterrupt" || error.interrupts) {
      // The graph was interrupted — we need to get state from the checkpointer
      // This shouldn't happen with the latest LangGraph JS, but handle it just in case
      return NextResponse.json(
        { error: "Graph interrupted unexpectedly" },
        { status: 500 }
      );
    }

    if (projectId && runId) {
      await updateResearchRunStatus({
        projectId,
        runId,
        status: "failed",
      }).catch(() => {
        // Preserve the original route error if status sync also fails.
      });
    }

    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
