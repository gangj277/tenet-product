import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { backfillWarmRunsForUser } from "@/lib/db/backfill-warm-runs";
import { listResearchProjectsForUser } from "@/lib/db/research-projects";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await backfillWarmRunsForUser(session.userId);
  const rows = await listResearchProjectsForUser(session.userId);

  return NextResponse.json({ projects: rows });
}
