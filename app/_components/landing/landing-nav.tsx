"use client";

import Link from "next/link";

export default function LandingNav({ authed }: { authed: boolean | null }) {
  const ctaHref = authed ? "/dashboard" : "/auth/login";
  const navLabel = authed ? "Dashboard" : "Sign in";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-page/70 backdrop-blur-md border-b border-edge/30">
      <div className="mx-auto max-w-[1080px] px-6 lg:px-8 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 font-serif text-[17px] tracking-tight text-heading">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-accent">
            <defs>
              <clipPath id="nav-clip"><circle cx="20" cy="16" r="10.5"/></clipPath>
            </defs>
            <circle cx="12" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.3" opacity="0.28"/>
            <circle cx="20" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.3" opacity="0.28"/>
            <circle cx="12" cy="16" r="10.5" fill="currentColor" opacity="0.07" clipPath="url(#nav-clip)"/>
            <path d="M16 5.87A10.5 10.5 0 0 0 16 26.13" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.55"/>
            <path d="M16 5.87A10.5 10.5 0 0 1 16 26.13" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.55"/>
            <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="0.5" opacity="0.12"/>
            <circle cx="16" cy="16" r="2.2" fill="currentColor" opacity="0.85"/>
          </svg>
          Lumen
        </a>
        <div className="flex items-center gap-6">
          <a
            href="#artifacts"
            className="hidden sm:inline font-sans text-[13px] text-dim hover:text-sub transition-colors duration-300"
          >
            Artifacts
          </a>
          {authed !== null && (
            <Link
              href={ctaHref}
              className="font-sans text-[13px] font-medium text-sub hover:text-heading transition-colors duration-300"
            >
              {navLabel}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
