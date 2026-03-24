"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageBody />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const mode = searchParams.get("mode");

  return <LoginPageBody error={error} showPaste={mode === "paste"} />;
}

function LoginPageBody({
  error,
  showPaste = false,
}: {
  error?: string | null;
  showPaste?: boolean;
} = {}) {
  const router = useRouter();
  const [pasteMode, setPasteMode] = useState(showPaste);
  const [authJson, setAuthJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTokenPaste = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Parse the pasted JSON — accept either the full auth.json or just the tokens object
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(authJson.trim());
      } catch {
        throw new Error("Invalid JSON. Copy the entire contents of ~/.codex/auth.json.");
      }

      // Support both full auth.json format and direct tokens object
      const tokens = (parsed.tokens ?? parsed) as Record<string, unknown>;
      const accessToken =
        (tokens.access_token as string) || (tokens.accessToken as string) || "";
      const refreshToken =
        (tokens.refresh_token as string) || (tokens.refreshToken as string) || "";
      const idToken =
        (tokens.id_token as string) || (tokens.idToken as string) || "";

      if (!accessToken || !refreshToken) {
        throw new Error("Missing access_token or refresh_token in the pasted JSON.");
      }

      const res = await fetch("/api/auth/openai/token-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, refreshToken, idToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Sign-in failed (HTTP ${res.status})`);
      }

      router.push("/dashboard");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [authJson, router]);

  const displayError = submitError || (error && !showPaste ? error : null);

  return (
    <div className="reveal">
      <div className="decorative-diamond mb-8 opacity-50" />

      <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-2">
        Continue with OpenAI
      </h1>
      <p className="font-sans text-[13.5px] leading-[1.65] text-sub mb-10">
        {pasteMode
          ? "Paste your Codex session to sign in. Run the command below on a machine where you\u2019ve logged into Codex, then paste the output here."
          : "Lumen imports the OpenAI session already connected through Codex on this device, then uses that account for sign-in and runtime access."}
      </p>

      {displayError && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
          <p className="font-sans text-[13px] text-red-400">{displayError}</p>
        </div>
      )}

      {!pasteMode ? (
        <>
          <a
            href="/api/auth/openai"
            className="group flex items-center justify-center gap-2.5 w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
            </svg>
            Continue with OpenAI
          </a>

          <button
            onClick={() => setPasteMode(true)}
            className="mt-4 w-full font-sans text-[13px] text-dim hover:text-sub transition-colors py-2 cursor-pointer"
          >
            Or paste session tokens manually
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg border border-edge/40 bg-edge/10">
            <p className="font-mono text-[12px] text-sub leading-[1.6] select-all">
              cat ~/.codex/auth.json
            </p>
          </div>

          <textarea
            value={authJson}
            onChange={(e) => setAuthJson(e.target.value)}
            placeholder='Paste the contents of ~/.codex/auth.json here...'
            rows={6}
            disabled={submitting}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 font-mono text-[12px] leading-[1.6] text-heading placeholder:text-dim/40 focus:outline-none focus:border-accent/40 transition-all resize-y disabled:opacity-50"
          />

          <button
            onClick={handleTokenPaste}
            disabled={!authJson.trim() || submitting}
            className="w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Signing in..." : "Sign in with pasted tokens"}
          </button>

          <button
            onClick={() => setPasteMode(false)}
            className="w-full font-sans text-[13px] text-dim hover:text-sub transition-colors py-2 cursor-pointer"
          >
            Back to automatic sign-in
          </button>
        </div>
      )}

      <div className="mt-8 px-4 py-4 rounded-xl border border-edge/40 bg-edge/10">
        <p className="font-sans text-[12px] font-medium text-heading mb-1.5">
          How it works
        </p>
        <p className="font-sans text-[12.5px] leading-[1.65] text-sub">
          Lumen uses your OpenAI Codex session for authentication and LLM access.
          On a local machine, click &ldquo;Continue with OpenAI&rdquo; to auto-detect your session.
          On the web, paste the output of <code className="px-1 py-0.5 rounded bg-edge/20 text-[11px]">cat ~/.codex/auth.json</code> from
          a machine where you&apos;ve run <code className="px-1 py-0.5 rounded bg-edge/20 text-[11px]">codex login</code>.
        </p>
      </div>
    </div>
  );
}
