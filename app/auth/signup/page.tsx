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
