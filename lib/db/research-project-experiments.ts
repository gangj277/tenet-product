import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { experiments, papers } from "./schema";
import type { ExperimentMeta } from "./research-project-types";

export async function createExperiment(
  runId: string,
  params: { id?: string; title: string; content?: string }
): Promise<string> {
  const id = params.id ?? crypto.randomUUID();
  await db.insert(experiments).values({
    id,
    runId,
    title: params.title,
    content: params.content ?? "",
  });
  return id;
}

export async function deleteExperiment(runId: string, experimentId: string): Promise<boolean> {
  const result = await db
    .delete(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.runId, runId)));

  return (result.rowCount ?? 0) > 0;
}

export async function getExperimentMetadataForRun(
  runId: string
): Promise<Record<string, ExperimentMeta>> {
  const rows = await db
    .select({
      id: experiments.id,
      title: experiments.title,
    })
    .from(experiments)
    .where(eq(experiments.runId, runId));

  const result: Record<string, ExperimentMeta> = {};
  for (const row of rows) {
    result[row.id] = { title: row.title };
  }
  return result;
}

export async function deletePaper(runId: string, paperId: string): Promise<boolean> {
  const result = await db
    .delete(papers)
    .where(and(eq(papers.id, paperId), eq(papers.runId, runId)));

  return (result.rowCount ?? 0) > 0;
}
