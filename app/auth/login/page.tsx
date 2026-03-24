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

  return <LoginPageBody error={error} initialMode={mode === "paste" ? "paste" : "auto"} />;
}

type AuthMode = "auto" | "paste" | "setup";

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [command]);

  return (
    <button
      onClick={handleCopy}
      className="group w-full flex items-center justify-between px-4 py-3 rounded-lg border border-edge/40 bg-edge/10 hover:border-edge/60 hover:bg-edge/15 transition-all cursor-pointer"
    >
      <code className="font-mono text-[12px] text-sub leading-[1.6]">
        {command}
      </code>
      <span className="flex items-center gap-1 text-[11px] text-dim group-hover:text-sub transition-colors shrink-0 ml-3">
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy
          </>
        )}
      </span>
    </button>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-edge/20 border border-edge/30 flex items-center justify-center font-mono text-[10px] text-dim font-semibold">
      {n}
    </span>
  );
}

function LoginPageBody({
  error,
  initialMode = "auto",
}: {
  error?: string | null;
  initialMode?: AuthMode;
} = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [authJson, setAuthJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTokenPaste = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(authJson.trim());
      } catch {
        throw new Error("Invalid JSON. Copy the entire contents of ~/.codex/auth.json.");
      }

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

  const displayError = submitError || error;

  return (
    <div className="reveal">
      <div className="decorative-diamond mb-8 opacity-50" />

      <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-2">
        Sign in to Lumen
      </h1>
      <p className="font-sans text-[13.5px] leading-[1.65] text-sub mb-8">
        Lumen uses your OpenAI account for authentication and LLM access.
      </p>

      {displayError && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
          <p className="font-sans text-[13px] text-red-400">{displayError}</p>
        </div>
      )}

      {/* ── Auto-detect mode (local/Electron) ── */}
      {mode === "auto" && (
        <div className="space-y-4">
          <a
            href="/api/auth/openai"
            className="group flex items-center justify-center gap-2.5 w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
            </svg>
            Continue with OpenAI
          </a>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-edge/30" />
            <span className="font-sans text-[11px] text-dim uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-edge/30" />
          </div>

          <button
            onClick={() => setMode("paste")}
            className="w-full flex items-center justify-center gap-2 font-sans text-[13px] font-medium text-sub hover:text-heading py-3 rounded-lg border border-edge/40 hover:border-edge/60 hover:bg-edge/10 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            I have Codex installed — paste session
          </button>

          <button
            onClick={() => setMode("setup")}
            className="w-full flex items-center justify-center gap-2 font-sans text-[13px] text-dim hover:text-sub py-2.5 transition-colors cursor-pointer"
          >
            I don&apos;t have Codex — help me set up
          </button>
        </div>
      )}

      {/* ── Paste mode (has Codex, needs to paste auth.json) ── */}
      {mode === "paste" && (
        <div className="space-y-4">
          <p className="font-sans text-[13px] text-sub leading-[1.65]">
            Run this in your terminal to copy your session to clipboard:
          </p>

          <CopyCommand command="cat ~/.codex/auth.json | pbcopy" />

          <p className="font-sans text-[11px] text-dim">
            Linux: use <button onClick={() => navigator.clipboard.writeText("cat ~/.codex/auth.json | xclip -selection clipboard")} className="font-mono text-accent hover:underline cursor-pointer">xclip</button> instead of pbcopy.
            Or just copy the file contents manually.
          </p>

          <textarea
            value={authJson}
            onChange={(e) => setAuthJson(e.target.value)}
            placeholder="Paste your auth.json contents here..."
            rows={5}
            disabled={submitting}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 font-mono text-[12px] leading-[1.6] text-heading placeholder:text-dim/40 focus:outline-none focus:border-accent/40 transition-all resize-y disabled:opacity-50"
          />

          <button
            onClick={handleTokenPaste}
            disabled={!authJson.trim() || submitting}
            className="w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Signing in\u2026" : "Sign in"}
          </button>

          <button
            onClick={() => setMode("auto")}
            className="w-full font-sans text-[12px] text-dim hover:text-sub transition-colors py-1.5 cursor-pointer"
          >
            Back
          </button>
        </div>
      )}

      {/* ── Setup mode (no Codex installed) ── */}
      {mode === "setup" && (
        <div className="space-y-5">
          <div className="px-4 py-4 rounded-xl border border-edge/40 bg-edge/10 space-y-4">
            <p className="font-sans text-[12px] font-medium text-heading">
              One-time setup (takes ~2 minutes)
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <StepNumber n={1} />
                <div className="flex-1 space-y-2">
                  <p className="font-sans text-[12.5px] text-sub leading-[1.6]">
                    Install and login to Codex:
                  </p>
                  <CopyCommand command="npx codex login" />
                  <p className="font-sans text-[11px] text-dim leading-[1.5]">
                    This opens OpenAI in your browser. Sign in with the account that has your ChatGPT Pro / Plus subscription.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <StepNumber n={2} />
                <div className="flex-1 space-y-2">
                  <p className="font-sans text-[12.5px] text-sub leading-[1.6]">
                    Copy your session to clipboard:
                  </p>
                  <CopyCommand command="cat ~/.codex/auth.json | pbcopy" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <StepNumber n={3} />
                <p className="font-sans text-[12.5px] text-sub leading-[1.6]">
                  Paste it below and sign in.
                </p>
              </div>
            </div>
          </div>

          <textarea
            value={authJson}
            onChange={(e) => setAuthJson(e.target.value)}
            placeholder="Paste your auth.json contents here..."
            rows={5}
            disabled={submitting}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 font-mono text-[12px] leading-[1.6] text-heading placeholder:text-dim/40 focus:outline-none focus:border-accent/40 transition-all resize-y disabled:opacity-50"
          />

          <button
            onClick={handleTokenPaste}
            disabled={!authJson.trim() || submitting}
            className="w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Signing in\u2026" : "Sign in"}
          </button>

          <button
            onClick={() => setMode("auto")}
            className="w-full font-sans text-[12px] text-dim hover:text-sub transition-colors py-1.5 cursor-pointer"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
