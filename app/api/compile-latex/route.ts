import { compile } from "node-latex-compiler";
import { getSession } from "@/lib/auth/session";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  try {
    const { tex } = await request.json();

    if (!tex || typeof tex !== "string") {
      return Response.json({ error: "Missing or invalid `tex` field" }, { status: 400 });
    }

    console.log(`[compile-latex] Starting compilation (${tex.length} chars)`);

    const result = await compile({ tex, returnBuffer: true });

    console.log(`[compile-latex] Done in ${Date.now() - t0}ms — status: ${result.status}`);

    if (result.status === "success" && result.pdfBuffer) {
      return new Response(new Uint8Array(result.pdfBuffer), {
        headers: { "Content-Type": "application/pdf" },
      });
    }

    return Response.json(
      { error: "Compilation failed", stderr: result.stderr, stdout: result.stdout },
      { status: 422 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[compile-latex] Error after ${Date.now() - t0}ms:`, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
