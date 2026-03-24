"use client";

import Link from "next/link";

export default function LandingHero({ authed }: { authed: boolean | null }) {
  const ctaHref = authed ? "/dashboard" : "/auth/login";
  const ctaLabel = authed ? "Go to dashboard" : "Sign in";

  return (
    <section className="relative min-h-[100svh] flex flex-col justify-end pb-16 sm:pb-24 md:pb-32 pt-32 overflow-hidden">
      <div className="section-bg fade-bottom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-bg.png" alt="" aria-hidden="true" />
      </div>
      <div className="section-bg bg-hero-atmosphere" />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8 w-full">
        <p className="reveal font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-6">
          AI-native research workspace
        </p>

        <h1 className="reveal reveal-delay-1 font-serif font-normal text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.035em] text-heading">
          Research that shows<br />
          <em className="not-italic text-accent">its work.</em>
        </h1>

        <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row sm:items-end justify-between gap-10">
          <p className="reveal reveal-delay-2 font-sans text-[15px] sm:text-base leading-relaxed text-sub max-w-[46ch]">
            Lumen turns rough questions into structured synthesis &mdash;
            with tracked claims, visible contradictions, evidence maps,
            and an AI partner grounded in your sources.
          </p>

          <div className="reveal reveal-delay-3 self-start sm:self-auto">
            <Link
              href={ctaHref}
              className="inline-flex items-center font-sans text-[14px] font-medium px-7 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="reveal reveal-delay-4 mt-16 sm:mt-20 h-px bg-edge/60" />
      </div>
    </section>
  );
}
