import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { MODEL_LITE } from "@/lib/llm/models";
import { createProviderForUser } from "@/lib/llm/provider-factory";
import { getStorage } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, sessionId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { userMessage, agentReply } = body as {
    userMessage?: string;
    agentReply?: string;
  };

  if (!userMessage) {
    return NextResponse.json({ error: "userMessage required" }, { status: 400 });
  }

  // Generate a concise title from the conversation
  const truncatedUser = userMessage.slice(0, 300);
  const truncatedAgent = (agentReply ?? "").slice(0, 500);

  try {
    const provider = await createProviderForUser(session.userId);
    const response = await provider.callLLM({
      messages: [
        {
          role: "system",
          content:
            "Generate a short, descriptive title (3-8 words) for this research chat session. The title should capture the main topic or question discussed. Return ONLY the title text, nothing else. No quotes, no punctuation at the end, no prefix.",
        },
        {
          role: "user",
          content: `User: ${truncatedUser}\n\nAssistant: ${truncatedAgent}`,
        },
      ],
      model: MODEL_LITE,
      temperature: 0.3,
      maxTokens: 30,
    });

    const title = response.content.trim().replace(/^["']|["']$/g, "").slice(0, 100);

    if (title) {
      await storage.updateSessionTitle(sessionId, title);
      return NextResponse.json({ title });
    }

    return NextResponse.json({ title: null });
  } catch {
    // Title generation is non-critical — don't fail the request
    return NextResponse.json({ title: null });
  }
}
