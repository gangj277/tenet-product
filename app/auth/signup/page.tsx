"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTokenPaste, setShowTokenPaste] = useState(false);
  const [tokenJson, setTokenJson] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  const handleTokenPaste = async () => {
    setError(null);
    setTokenLoading(true);
    try {
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(tokenJson.trim());
      } catch {
        throw new Error("Invalid JSON. Paste the full contents of ~/.codex/auth.json");
      }

      const tokens = (raw.tokens as Record<string, string> | undefined) ?? raw;
      const accessToken = tokens.access_token ?? tokens.access;
      const refreshToken = tokens.refresh_token ?? tokens.refresh ?? "";
      const accountId = tokens.account_id ?? "";

      if (!accessToken) {
        throw new Error("Could not find access token. Make sure you pasted the full auth.json content.");
      }

      const res = await fetch("/api/auth/openai/token-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          accountId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Token validation failed");

      router.push(data.isNewUser ? "/auth/onboarding" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          organization: organization.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
      }

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name.trim() && email.trim() && password.length >= 8;

  return (
    <div className="reveal">
      {/* Diamond accent */}
      <div className="decorative-diamond mb-8 opacity-50" />

      {/* Header */}
      <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-2">
        Create your workspace
      </h1>
      <p className="font-sans text-[13.5px] leading-[1.65] text-sub mb-10">
        Start building structured, evidence-grounded research.
      </p>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
          <p className="font-sans text-[13px] text-red-400">{error}</p>
        </div>
      )}

      {/* OpenAI Connection */}
      {!showTokenPaste ? (
        <button
          onClick={() => setShowTokenPaste(true)}
          className="group flex items-center justify-center gap-2.5 w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
          Connect ChatGPT account
        </button>
      ) : (
        <div className="rounded-xl border border-edge/40 overflow-hidden">
          <div className="px-5 pt-5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" />
                </svg>
              </div>
              <div>
                <p className="font-sans text-[13px] font-semibold text-heading leading-tight">Connect OpenAI</p>
                <p className="font-sans text-[11px] text-mute">Uses your ChatGPT subscription</p>
              </div>
            </div>
            <button
              onClick={() => { setShowTokenPaste(false); setTokenJson(""); setError(null); }}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-edge/20 text-mute hover:text-sub transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-4 space-y-3">
            <StepItem number={1} label="Run this in your terminal">
              <CopyableCommand command="npx @openai/codex login" />
            </StepItem>
            <StepItem number={2} label="Then run this to copy your token">
              <CopyableCommand command="cat ~/.codex/auth.json | pbcopy" />
            </StepItem>
            <StepItem number={3} label="Paste below">
              <textarea
                value={tokenJson}
                onChange={(e) => setTokenJson(e.target.value)}
                placeholder="Paste auth.json contents here..."
                rows={3}
                className="w-full bg-edge/10 border border-edge/30 rounded-lg px-3.5 py-2.5 text-[12px] font-mono text-heading placeholder:text-dim/30 focus:outline-none focus:border-accent/40 transition-all duration-200 resize-none"
              />
            </StepItem>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={handleTokenPaste}
              disabled={!tokenJson.trim() || tokenLoading}
              className="w-full font-sans text-[13px] font-medium py-2.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {tokenLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                "Connect & create workspace"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-edge/30" />
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-mute">or</span>
        <div className="flex-1 h-px bg-edge/30" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Full name"
          type="text"
          value={name}
          onChange={setName}
          placeholder="Jane Doe"
          autoFocus
          disabled={loading}
        />
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@institution.edu"
          disabled={loading}
        />
        <AuthField
          label="Research organization"
          type="text"
          value={organization}
          onChange={setOrganization}
          placeholder="MIT CSAIL, Stanford NLP Group, etc."
          disabled={loading}
          hint="Optional"
        />
        <div>
          <AuthField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Min. 8 characters"
            disabled={loading}
          />
          {password.length > 0 && password.length < 8 && (
            <p className="font-sans text-[11px] text-amber-500/80 mt-1.5 pl-0.5">
              {8 - password.length} more character{8 - password.length !== 1 ? "s" : ""} needed
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full font-sans text-[14px] font-medium py-3 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="w-3.5 h-3.5 border-2 border-on-accent/60 border-t-transparent rounded-full animate-spin" />
              Creating workspace...
            </span>
          ) : (
            "Create workspace"
          )}
        </button>
      </form>

      {/* Footer link */}
      <p className="font-sans text-[13px] text-dim mt-8 text-center">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-accent hover:text-accent-hover transition-colors underline underline-offset-[3px] decoration-accent/30"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ── Step + Command helpers ── */

function StepItem({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-edge/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="font-mono text-[10px] font-bold text-sub">{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[12px] text-sub mb-1.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="group w-full flex items-center justify-between gap-2 bg-zinc-900 rounded-lg px-3.5 py-2.5 cursor-pointer hover:bg-zinc-800 transition-colors"
    >
      <code className="font-mono text-[11.5px] text-zinc-300 truncate">{command}</code>
      <span className="flex-shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors">
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ── Reusable field ── */

function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim block mb-2">
        {label}
        {hint && (
          <span className="font-normal normal-case tracking-normal text-mute ml-1.5">
            — {hint}
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 text-[14px] text-heading placeholder:text-dim/50 focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 disabled:opacity-50"
      />
    </div>
  );
}
