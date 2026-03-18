import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun, getPersistedArtifacts, getExperimentMetadataForRun, getNoteMetadataForRun, getSourceMetadataForRun } from "@/lib/db/research-projects";
import { memoryStore } from "@/lib/storage/memory-store";
import { buildFileList, getArtifactContent } from "@/app/dashboard/[runId]/_lib/workspace-types";
import { runAgentLoop } from "@/lib/agent/graph";
import type { LLMMessage, ContentPart } from "@/lib/llm/openrouter";
import { costTracker } from "@/lib/llm/openrouter";
import type { WorkspaceContext, SSEEvent } from "@/lib/agent/state";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import type { Artifacts } from "@/lib/engine/state";
import { parsePDF } from "@/lib/pdf/gemini-extract";
import { checkUserBudget, recordUserCost } from "@/lib/rate-limit";

export const maxDuration = 300;

interface ChatAttachment {
  type: "image" | "pdf";
  name: string;
  base64: string;
  mimeType: string;
}

interface ChatRequestBody {
  message: string;
  attachments?: ChatAttachment[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  workspaceContext?: {
    editedContents?: Record<string, string>;
    activeFileKey?: string;
    searchFilters?: SearchFilterConfig;
  };
}

function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // Auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user daily cost budget check
  const budgetCheck = checkUserBudget(session.userId);
  if (!budgetCheck.allowed) {
    return NextResponse.json(
      {
        error: `Daily usage limit reached ($${budgetCheck.spentUsd.toFixed(2)}/$${budgetCheck.limitUsd}). Resets at midnight UTC.`,
      },
      { status: 429 }
    );
  }

  // Verify ownership
  const run = await getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Parse request body
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasAttachments = body.attachments && body.attachments.length > 0;
  if (!body.message?.trim() && !hasAttachments) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Validate attachments
  if (body.attachments) {
    const imageAttachments = body.attachments.filter((a) => a.type === "image");
    if (imageAttachments.length > 5) {
      return NextResponse.json({ error: "Maximum 5 image attachments allowed" }, { status: 400 });
    }
    for (const att of body.attachments) {
      const sizeBytes = Buffer.byteLength(att.base64, "base64");
      if (att.type === "image" && sizeBytes > 10 * 1024 * 1024) {
        return NextResponse.json({ error: `Image "${att.name}" exceeds 10MB limit` }, { status: 400 });
      }
      if (att.type === "pdf" && sizeBytes > 20 * 1024 * 1024) {
        return NextResponse.json({ error: `PDF "${att.name}" exceeds 20MB limit` }, { status: 400 });
      }
    }
  }

  // Load artifacts (memory-store first, then DB)
  let artifacts: Artifacts | undefined;
  const memRun = memoryStore.getRun(runId);
  if (memRun?.artifacts) {
    artifacts = memRun.artifacts;
  } else {
    const memArtifacts = memoryStore.getArtifacts(run.projectId);
    if (memArtifacts) {
      artifacts = memArtifacts;
    } else {
      const persisted = await getPersistedArtifacts(runId);
      if (persisted) {
        artifacts = persisted;
      }
    }
  }

  if (!artifacts) {
    return NextResponse.json(
      { error: "Artifacts not available for this run" },
      { status: 404 }
    );
  }

  // Build workspace context with edited contents overlay
  const [notesMeta, experimentsMeta, sourcesMeta] = await Promise.all([
    getNoteMetadataForRun(runId),
    getExperimentMetadataForRun(runId),
    getSourceMetadataForRun(runId),
  ]);
  const fileList = buildFileList(artifacts, sourcesMeta, notesMeta, experimentsMeta);
  const editedContents = body.workspaceContext?.editedContents ?? {};

  const workspaceFiles: Record<string, string> = {};
  for (const file of fileList) {
    if (file.key in editedContents) {
      workspaceFiles[file.key] = editedContents[file.key];
    } else {
      workspaceFiles[file.key] = getArtifactContent(artifacts, file.key);
    }
  }

  const workspaceCtx: WorkspaceContext = {
    runId,
    workspaceFiles,
    activeFileKey: body.workspaceContext?.activeFileKey,
    availableKeys: fileList.map((f) => f.key),
    fileLabels: Object.fromEntries(fileList.map((f) => [f.key, f.label])),
    fileMeta: Object.fromEntries(
      fileList.map((f) => [f.key, { group: f.group, origin: f.origin, folder: f.folder }])
    ),
    searchFilters: body.workspaceContext?.searchFilters,
  };

  // Build conversation history
  const conversationHistory: LLMMessage[] = (body.conversationHistory ?? []).map((msg) => ({
    role: msg.role === "user" ? "user" as const : "assistant" as const,
    content: msg.content,
  }));

  // Process attachments
  let augmentedMessage = body.message || "";
  const imageContentParts: ContentPart[] = [];

  if (body.attachments) {
    for (const att of body.attachments) {
      if (att.type === "image") {
        imageContentParts.push({
          type: "image_url",
          image_url: { url: `data:${att.mimeType};base64,${att.base64}` },
        });
      } else if (att.type === "pdf") {
        try {
          const pdfBuffer = Buffer.from(att.base64, "base64");
          const result = await parsePDF(pdfBuffer, att.name);
          augmentedMessage += `\n\n[Attached PDF: ${att.name}]\n${result.text}`;
        } catch {
          augmentedMessage += `\n\n[Attached PDF: ${att.name} — failed to extract text]`;
        }
      }
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const costBefore = costTracker.snapshot().totalCostUsd;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgentLoop(
          augmentedMessage,
          conversationHistory,
          workspaceCtx,
          imageContentParts.length > 0 ? imageContentParts : undefined,
        )) {
          controller.enqueue(encoder.encode(formatSSE(event)));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent error";
        const errorEvent: SSEEvent = { type: "error", message };
        controller.enqueue(encoder.encode(formatSSE(errorEvent)));
        const doneEvent: SSEEvent = { type: "done" };
        controller.enqueue(encoder.encode(formatSSE(doneEvent)));
      } finally {
        const costAfter = costTracker.snapshot().totalCostUsd;
        recordUserCost(session.userId, costAfter - costBefore);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
