import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { openLocalPathInEditor } from "@/lib/workspace/open-in-editor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileKey = new URL(request.url).searchParams.get("key")?.trim();
  if (!fileKey) {
    return NextResponse.json({ error: "File key is required" }, { status: 400 });
  }

  const { runId } = await params;
  const storage = await getStorage();
  const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
  if (!ownedRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const filePath = await storage.getLocalWorkspaceFilePath(runId, fileKey);
  if (!filePath) {
    return NextResponse.json(
      { error: "Local workspace file not found" },
      { status: 404 }
    );
  }

  const result = await openLocalPathInEditor(filePath);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Unable to open the file in an editor." },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
