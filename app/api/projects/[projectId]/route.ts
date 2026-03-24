import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { memoryStore } from "@/lib/storage/memory-store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const storage = await getStorage();
  const before = await storage.listResearchProjectsForUser(session.userId);
  const project = before.find((entry) => entry.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await storage.deleteProjectForUser(session.userId, projectId);
  memoryStore.deleteProject(projectId);

  return NextResponse.json({ deleted: true });
}
