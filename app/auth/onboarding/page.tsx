"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push("/auth/login");
          return;
        }
        setUserEmail(data.user.email);
        if (data.user.name && data.user.name !== "Researcher") {
          setName(data.user.name);
        }
      })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reveal">
      <div className="decorative-diamond mb-8 opacity-50" />

      <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-2">
        Welcome to Lumen
      </h1>
      <p className="font-sans text-[13.5px] leading-[1.65] text-sub mb-2">
        Tell us a bit about yourself to personalize your workspace.
      </p>
      {userEmail && (
        <p className="font-sans text-[12px] text-mute mb-8">
          Signed in as <span className="text-sub">{userEmail}</span>
        </p>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
          <p className="font-sans text-[13px] text-red-400">{error}</p>
        </div>
      )}

      <div className="mb-6 px-4 py-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span className="font-sans text-[12px] font-medium text-emerald-400">OpenAI connected</span>
        </div>
        <p className="font-sans text-[11px] text-emerald-400/60 pl-6">
          Your ChatGPT subscription will power all AI features.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim block mb-2">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoFocus
            disabled={loading}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 text-[14px] text-heading placeholder:text-dim/50 focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-dim block mb-2">
            Research organization
            <span className="font-normal normal-case tracking-normal text-mute ml-1.5">
              — Optional
            </span>
          </label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="MIT CSAIL, Stanford NLP Group, etc."
            disabled={loading}
            className="w-full bg-transparent border border-edge/60 rounded-lg px-4 py-3 text-[14px] text-heading placeholder:text-dim/50 focus:outline-none focus:border-accent/40 focus:glow-accent-sm transition-all duration-300 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full font-sans text-[14px] font-medium py-3 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 glow-accent-sm hover:glow-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="w-3.5 h-3.5 border-2 border-on-accent/60 border-t-transparent rounded-full animate-spin" />
              Setting up...
            </span>
          ) : (
            "Start researching"
          )}
        </button>
      </form>
    </div>
  );
}
