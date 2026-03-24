import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; paperId: string }> }
) {
  try {
    const { runId, paperId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = await getStorage();
    const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const deleted = await storage.deletePaper(runId, paperId);
    if (!deleted) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // Evict from memory store if cached
    const cachedArtifacts = memoryStore.getArtifacts(ownedRun.projectId);
    if (cachedArtifacts?.papers) {
      delete cachedArtifacts.papers[paperId];
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Failed to delete paper:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
