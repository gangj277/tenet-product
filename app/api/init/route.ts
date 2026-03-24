import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils/id";
import { initGraph } from "@/lib/engine/graph";
import { memoryStore } from "@/lib/storage/memory-store";
import type { UserInput, SourceEntry } from "@/lib/engine/state";
import { getSession } from "@/lib/auth/session";
import { runWithRequestProvider } from "@/lib/llm/runtime";
import { ensureOpenAIProviderAccess } from "@/lib/llm/openai-access";
import { acquireExclusiveLock } from "@/lib/utils/exclusive-lock";
import { getStorage } from "@/lib/storage";

export const maxDuration = 300;

interface InitRequestBody {
  input: UserInput;
  sources?: SourceEntry[];
  workspacePath?: string;
}

export async function POST(request: NextRequest) {
  let projectId: string | null = null;
  let runId: string | null = null;
  let releaseLock: (() => void) | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const storage = await getStorage();

    releaseLock = acquireExclusiveLock(`init:${session.userId}`);
    if (!releaseLock) {
      return NextResponse.json(
        { error: "An init pipeline is already running for this account." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as InitRequestBody;
    const workspacePath =
      typeof body.workspacePath === "string" ? body.workspacePath.trim() : undefined;

    if (!body.input?.researchQuestion?.trim()) {
      return NextResponse.json(
        { error: "researchQuestion is required" },
        { status: 400 }
      );
    }

    if (process.env.ELECTRON) {
      if (!workspacePath) {
        return NextResponse.json(
          { error: "workspacePath is required in Electron mode" },
          { status: 400 }
        );
      }

      if (!path.isAbsolute(workspacePath)) {
        return NextResponse.json(
          { error: "workspacePath must be an absolute path" },
          { status: 400 }
        );
      }
    }

    const provider = await ensureOpenAIProviderAccess(session.userId, {
      forceRevalidate: true,
    });

    projectId = generateId();
    runId = generateId();
    const threadId = runId; // 1:1 mapping for simplicity

    await storage.createResearchProjectRun({
      projectId,
      runId,
      userId: session.userId,
      input: body.input,
      ...(workspacePath ? { workspacePath } : {}),
      status: "running",
    });

    memoryStore.setRun(runId, {
      projectId,
      runId,
      status: "running",
      updatedAt: new Date().toISOString(),
    });

    const config = { configurable: { thread_id: threadId } };

    const initialState = {
      projectId,
      runId,
      userId: session.userId,
      status: "queued" as const,
      input: body.input,
      sources: body.sources ?? [],
    };

    const result = await runWithRequestProvider(provider, () =>
      initGraph.invoke(initialState, config)
    );

    // After invoke returns due to interrupt, update run status
    memoryStore.setRun(runId, {
      projectId,
      runId,
      status: "awaiting_confirmation",
      updatedAt: new Date().toISOString(),
    });

    await storage.updateResearchRunStatus({
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

    console.error("[init] Pipeline error:", (err as Error).message);

    if (projectId && runId) {
      const storage = await getStorage();
      await storage.updateResearchRunStatus({
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
  } finally {
    releaseLock?.();
  }
}
