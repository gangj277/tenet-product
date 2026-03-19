import { db } from "./client";
import { chatSessions, chatMessages } from "./schema";
import { and, eq, desc, sql } from "drizzle-orm";

// ── Types ──

export interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface SessionMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Queries ──

export async function getSessionsForRun(
  runId: string
): Promise<SessionSummary[]> {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      messageCount: sql<number>`cast(count(${chatMessages.id}) as int)`,
    })
    .from(chatSessions)
    .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
    .where(eq(chatSessions.runId, runId))
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    messageCount: r.messageCount,
  }));
}

export async function createSession(
  runId: string,
  title?: string
): Promise<{ id: string; title: string | null }> {
  const [row] = await db
    .insert(chatSessions)
    .values({ runId, title: title ?? null })
    .returning({ id: chatSessions.id, title: chatSessions.title });

  return row;
}

export async function getSessionMessages(
  sessionId: string
): Promise<SessionMessage[]> {
  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      text: chatMessages.text,
      metadata: chatMessages.metadata,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    text: r.text,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function appendMessages(
  sessionId: string,
  messages: {
    id?: string;
    role: "user" | "agent";
    text: string;
    metadata?: Record<string, unknown>;
  }[]
) {
  if (messages.length === 0) return;

  await db.transaction(async (tx) => {
    await tx.insert(chatMessages).values(
      messages.map((m) => ({
        ...(m.id ? { id: m.id } : {}),
        sessionId,
        role: m.role,
        text: m.text,
        metadata: m.metadata ?? null,
      }))
    );

    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  });
}

export async function updateSessionTitle(sessionId: string, title: string) {
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function updateMessageMetadata(
  sessionId: string,
  messageId: string,
  metadata: Record<string, unknown>
) {
  await db.transaction(async (tx) => {
    await tx
      .update(chatMessages)
      .set({ metadata })
      .where(
        and(
          eq(chatMessages.id, messageId),
          eq(chatMessages.sessionId, sessionId)
        )
      );

    await tx
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  });
}

export async function deleteSession(sessionId: string) {
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}
