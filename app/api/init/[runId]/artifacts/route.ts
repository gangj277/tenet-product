import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import {
  mergeWorkspaceArtifacts,
  mergeWorkspaceSourceMeta,
} from "@/lib/workspace/source-cache";
import { getSession } from "@/lib/auth/session";
import {
  getOwnedResearchRun,
  getExperimentMetadataForRun,
  getNoteMetadataForRun,
  getPersistedArtifacts,
  getSourceMetadataForRun,
  updateArtifactContents,
} from "@/lib/db/research-projects";

export async function GET(
  _request: NextRequest,
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

    const run = memoryStore.getRun(runId);
    const [persistedArtifacts, persistedSourcesMeta] = await Promise.all([
      getPersistedArtifacts(runId),
      getSourceMetadataForRun(runId),
    ]);
    const artifacts = mergeWorkspaceArtifacts(
      memoryStore.getArtifacts(ownedRun.projectId),
      persistedArtifacts
    );

    if (!artifacts) {
      return NextResponse.json(
        { error: "Artifacts not yet available", status: run?.status ?? ownedRun.status },
        { status: 404 }
      );
    }

    const sourcesMeta = mergeWorkspaceSourceMeta(
      memoryStore.getSourcesMeta(ownedRun.projectId),
      persistedSourcesMeta
    );

    const notesMeta = await getNoteMetadataForRun(runId);
    const experimentsMeta = await getExperimentMetadataForRun(runId);

    return NextResponse.json({
      projectId: ownedRun.projectId,
      artifacts,
      sourcesMeta,
      notesMeta,
      experimentsMeta,
    });
  } catch (err) {
    console.error("Failed to load artifacts:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const edits = body.edits as Record<string, string> | undefined;
    if (!edits || typeof edits !== "object" || Object.keys(edits).length === 0) {
      return NextResponse.json({ error: "No edits provided" }, { status: 400 });
    }

    // Persist to database
    await updateArtifactContents(runId, edits);

    // Update memory store (if cached) so subsequent reads stay fresh
    const cached = memoryStore.getArtifacts(ownedRun.projectId);
    if (cached) {
      for (const [key, content] of Object.entries(edits)) {
        if (key.startsWith("paper:")) {
          if (!cached.papers) cached.papers = {};
          cached.papers[key.slice(6)] = content;
        } else if (key.startsWith("note:")) {
          if (!cached.notes) cached.notes = {};
          cached.notes[key.slice(5)] = content;
        } else if (key.startsWith("experiment:")) {
          if (!cached.experiments) cached.experiments = {};
          cached.experiments[key.slice(11)] = content;
        } else if (key.startsWith("source:")) {
          cached.sources[key.slice(7)] = content;
        } else if (key in cached) {
          (cached as unknown as Record<string, unknown>)[key] = content;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save artifact edits:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
