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
      let parsed: { access?: string; refresh?: string; expires?: number };
      try {
        parsed = JSON.parse(tokenJson.trim());
      } catch {
        throw new Error("Invalid JSON. Paste the full contents of ~/.codex/auth.json");
      }

      if (!parsed.access) {
        throw new Error('Missing "access" field. Make sure you pasted the full auth.json content.');
      }

      const res = await fetch("/api/auth/openai/token-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: parsed.access,
          refreshToken: parsed.refresh || "",
          expiresAt: parsed.expires,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Token validation failed");

      router.push("/dashboard");
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

      {/* OpenAI Token Paste */}
      {!showTokenPaste ? (
        <button
          onClick={() => setShowTokenPaste(true)}
          className="flex items-center justify-center gap-2.5 w-full font-sans text-[14px] font-medium py-3 bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-all duration-300 border border-edge/20 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 shrink-0" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
          Continue with OpenAI
        </button>
      ) : (
        <div className="space-y-3 mb-2">
          <div className="px-3 py-2.5 rounded-md border border-edge/30 bg-page/50">
            <p className="font-sans text-[12px] text-sub leading-relaxed">
              Run <code className="px-1.5 py-0.5 bg-edge/20 rounded text-[11px] font-mono">npx @openai/codex login</code> in your terminal, then paste the contents of <code className="px-1.5 py-0.5 bg-edge/20 rounded text-[11px] font-mono">~/.codex/auth.json</code> below.
            </p>
          </div>
          <textarea
            value={tokenJson}
            onChange={(e) => setTokenJson(e.target.value)}
            placeholder='{"access":"eyJ...","refresh":"...","expires":1234567890000}'
            rows={4}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 text-[12px] font-mono text-heading placeholder:text-dim/40 focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleTokenPaste}
              disabled={!tokenJson.trim() || tokenLoading}
              className="flex-1 font-sans text-[13px] font-medium py-2.5 bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-all duration-300 border border-edge/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {tokenLoading ? "Connecting..." : "Connect OpenAI"}
            </button>
            <button
              onClick={() => { setShowTokenPaste(false); setTokenJson(""); setError(null); }}
              className="px-3 py-2.5 font-sans text-[12px] text-dim hover:text-sub rounded-lg border border-edge/30 hover:border-edge/50 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-edge/30" />
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-mute">or sign up with email</span>
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
