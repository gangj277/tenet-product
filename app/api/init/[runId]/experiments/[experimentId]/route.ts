import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun, deleteExperiment } from "@/lib/db/research-projects";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; experimentId: string }> }
) {
  try {
    const { runId, experimentId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownedRun = await getOwnedResearchRun(session.userId, runId);
    if (!ownedRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const deleted = await deleteExperiment(runId, experimentId);
    if (!deleted) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    // Evict from memory store if cached
    const cachedArtifacts = memoryStore.getArtifacts(ownedRun.projectId);
    if (cachedArtifacts?.experiments) {
      delete cachedArtifacts.experiments[experimentId];
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Failed to delete experiment:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
