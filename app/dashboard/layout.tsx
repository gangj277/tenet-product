"use client";

import Link from "next/link";
import { useUser } from "@/lib/auth/use-user";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useUser();

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
                <button
                  onClick={logout}
                  className="font-sans text-[11px] uppercase tracking-[0.1em] text-dim hover:text-sub transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </>
            )}
            {loading && (
              <span className="w-3 h-3 border border-dim/40 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="pt-[72px]">{children}</main>
    </div>
  );
}
