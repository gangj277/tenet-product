import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { memoryStore } from "@/lib/storage/memory-store";
import {
  buildFileList,
  collectFolderPaths,
  getArtifactContent,
} from "@/app/dashboard/[runId]/_lib/workspace-types";
import { runAgentLoop } from "@/lib/agent/graph";
import type { LLMMessage, ContentPart } from "@/lib/llm/runtime";
import type {
  AgentContinuationState,
  WorkspaceContext,
  SSEEvent,
} from "@/lib/agent/state";
import type { SearchFilterConfig } from "@/lib/discovery/search-filters";
import type { Artifacts } from "@/lib/engine/state";
import { parsePDF } from "@/lib/pdf/gemini-extract";
import { ensureOpenAIProviderAccess } from "@/lib/llm/openai-access";
import { acquireExclusiveLock } from "@/lib/utils/exclusive-lock";
import type { ReasoningEffort } from "@/lib/llm/types";
import {
  mergeWorkspaceArtifacts,
  mergeWorkspaceSourceMeta,
} from "@/lib/workspace/source-cache";
import { getStorage } from "@/lib/storage";

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
  reasoningEffort?: ReasoningEffort;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  historyVisibleMessageCount?: number;
  agentState?: AgentContinuationState;
  workspaceContext?: {
    editedContents?: Record<string, string>;
    activeFileKey?: string;
    folderPaths?: string[];
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

  const releaseLock = acquireExclusiveLock(`chat:${runId}`);
  if (!releaseLock) {
    return NextResponse.json(
      { error: "Another agent response is already streaming for this workspace." },
      { status: 409 }
    );
  }

  let provider;
  try {
    provider = await ensureOpenAIProviderAccess(session.userId);
  } catch (err) {
    releaseLock();
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "OpenAI connection unavailable" },
      { status: 400 }
    );
  }

  // Verify ownership
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
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

  const reasoningEffort =
    body.reasoningEffort === "none" ||
    body.reasoningEffort === "low" ||
    body.reasoningEffort === "medium" ||
    body.reasoningEffort === "high" ||
    body.reasoningEffort === "xhigh"
      ? body.reasoningEffort
      : undefined;

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
  const memRun = memoryStore.getRun(runId);
  const [persistedArtifacts, persistedSourcesMeta, notesMeta, experimentsMeta] =
    await Promise.all([
      storage.getPersistedArtifacts(runId),
      storage.getSourceMetadataForRun(runId),
      storage.getNoteMetadataForRun(runId),
      storage.getExperimentMetadataForRun(runId),
    ]);

  const artifacts: Artifacts | null = mergeWorkspaceArtifacts(
    memRun?.artifacts ?? memoryStore.getArtifacts(run.projectId),
    persistedArtifacts
  );

  if (!artifacts) {
    return NextResponse.json(
      { error: "Artifacts not available for this run" },
      { status: 404 }
    );
  }

  // Build workspace context with edited contents overlay
  const sourcesMeta = mergeWorkspaceSourceMeta(
    typeof memoryStore.getSourcesMeta === "function"
      ? memoryStore.getSourcesMeta(run.projectId)
      : undefined,
    persistedSourcesMeta
  );
  const fileList = buildFileList(artifacts, sourcesMeta, notesMeta, experimentsMeta);
  const folderPaths = collectFolderPaths(
    fileList,
    body.workspaceContext?.folderPaths
  );
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
    folderPaths,
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
          const result = await parsePDF(pdfBuffer, att.name, { provider });
          augmentedMessage += `\n\n[Attached PDF: ${att.name}]\n${result.text}`;
        } catch {
          augmentedMessage += `\n\n[Attached PDF: ${att.name} — failed to extract text]`;
        }
      }
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgentLoop(
          augmentedMessage,
          conversationHistory,
          workspaceCtx,
          imageContentParts.length > 0 ? imageContentParts : undefined,
          undefined,
          provider,
          reasoningEffort,
          body.agentState,
          body.historyVisibleMessageCount,
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
        // Clean up any pending ask_user question (e.g. if stream was aborted)
        memoryStore.cancelPendingQuestion(runId);
        releaseLock();
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
