import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; noteId: string }> }
) {
  try {
    const { runId, noteId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = await getStorage();
    const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const deleted = await storage.deleteNote(runId, noteId);
    if (!deleted) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Evict from memory store
    const cached = memoryStore.getArtifacts(ownedRun.projectId);
    if (cached?.notes) {
      delete cached.notes[noteId];
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Failed to delete note:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; noteId: string }> }
) {
  try {
    const { runId, noteId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = await getStorage();
    const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: { label?: string; folder?: string | null } = {};
    if (typeof body.label === "string") updates.label = body.label;
    if ("folder" in body) updates.folder = body.folder ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const updated = await storage.updateNoteMeta(runId, noteId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update note:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
