import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { notes } from "./schema";
import type { NoteMeta } from "./research-project-types";

export async function createNote(
  runId: string,
  params: { id?: string; label: string; folder?: string; content?: string }
): Promise<string> {
  const id = params.id ?? crypto.randomUUID();
  await db.insert(notes).values({
    id,
    runId,
    label: params.label,
    folder: params.folder ?? null,
    content: params.content ?? "",
  });
  return id;
}

export async function deleteNote(runId: string, noteId: string): Promise<boolean> {
  const result = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.runId, runId)));
  return (result.rowCount ?? 0) > 0;
}

export async function updateNoteMeta(
  runId: string,
  noteId: string,
  updates: { label?: string; folder?: string | null }
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.folder !== undefined) set.folder = updates.folder;

  const result = await db
    .update(notes)
    .set(set)
    .where(and(eq(notes.id, noteId), eq(notes.runId, runId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getNoteMetadataForRun(
  runId: string
): Promise<Record<string, NoteMeta>> {
  const rows = await db
    .select({
      id: notes.id,
      label: notes.label,
      folder: notes.folder,
    })
    .from(notes)
    .where(eq(notes.runId, runId));

  const result: Record<string, NoteMeta> = {};
  for (const row of rows) {
    result[row.id] = {
      label: row.label,
      ...(row.folder ? { folder: row.folder } : {}),
    };
  }
  return result;
}
