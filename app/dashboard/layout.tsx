"use client";

import Link from "next/link";
import { useUser } from "@/lib/auth/use-user";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useUser();
  const showLogout = !!user && user.sessionMode !== "electron_local";

  return (
    <div className="min-h-screen grain">
      {/* ── Top bar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-page/70 backdrop-blur-md border-b border-edge/30">
        <div className="mx-auto max-w-[960px] px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-[17px] tracking-tight text-heading"
          >
            Lumen
          </Link>

          <div className="flex items-center gap-4">
            {!loading && user && (
              <>
                <span className="font-sans text-[12px] text-dim">
                  {user.name}
                  {user.organization && (
                    <span className="text-mute ml-1">
                      / {user.organization}
                    </span>
                  )}
                </span>
                {showLogout ? (
                  <button
                    onClick={logout}
                    className="font-sans text-[11px] uppercase tracking-[0.1em] text-dim hover:text-sub transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                ) : null}
              </>
            )}
            {loading && (
              <span className="w-3 h-3 border border-dim/40 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="pt-[72px]">
        {!loading &&
        user &&
        (!user.openaiConnected || user.openaiConnection?.status === "invalid") ? (
          <div className="max-w-[720px] mx-auto px-6 py-16">
            <div className="glass-panel rounded-2xl border border-red-500/20 px-8 py-10">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400/80 mb-4">
                OpenAI reconnect required
              </p>
              <h1 className="font-serif text-[clamp(1.5rem,3vw,2rem)] text-heading mb-3 tracking-[-0.02em]">
                This workspace is locked until your OpenAI connection validates.
              </h1>
              <p className="font-sans text-[14px] leading-[1.7] text-sub mb-6 max-w-[50ch]">
                {user.openaiConnection?.lastErrorMessage ||
                  "Your current OpenAI connection cannot access the Codex runtime. Reconnect with a supported OpenAI account to continue."}
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/api/auth/openai"
                  className="font-sans text-[13px] font-medium px-5 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300"
                >
                  Reconnect OpenAI
                </Link>
                {showLogout ? (
                  <button
                    onClick={logout}
                    className="font-sans text-[13px] text-dim hover:text-sub transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
