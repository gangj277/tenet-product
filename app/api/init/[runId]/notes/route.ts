import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun, createNote } from "@/lib/db/research-projects";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownedRun = await getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const body = await request.json();
    const { id, label, folder, content } = body as {
      id?: string;
      label: string;
      folder?: string;
      content?: string;
    };

    if (!label || typeof label !== "string") {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const noteId = await createNote(runId, {
      id,
      label,
      folder: folder || undefined,
      content: content ?? "",
    });

    // Update memory cache
    const cached = memoryStore.getArtifacts(ownedRun.projectId);
    if (cached) {
      if (!cached.notes) cached.notes = {};
      cached.notes[noteId] = content ?? "";
    }

    return NextResponse.json({ id: noteId, key: `note:${noteId}` });
  } catch (err) {
    console.error("Failed to create note:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
