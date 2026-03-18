import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun, createExperiment } from "@/lib/db/research-projects";

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
    const { id, title, content } = body as {
      id?: string;
      title: string;
      content?: string;
    };

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const experimentId = await createExperiment(runId, {
      id,
      title,
      content: content ?? "",
    });

    // Update memory cache
    const cached = memoryStore.getArtifacts(ownedRun.projectId);
    if (cached) {
      if (!cached.experiments) cached.experiments = {};
      cached.experiments[experimentId] = content ?? "";
    }

    return NextResponse.json({ id: experimentId, key: `experiment:${experimentId}` });
  } catch (err) {
    console.error("Failed to create experiment:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
