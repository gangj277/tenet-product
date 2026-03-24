"use client";

import Link from "next/link";

export default function LandingCta({ authed }: { authed: boolean | null }) {
  const ctaHref = authed ? "/dashboard" : "/auth/login";
  const ctaLabel = authed ? "Go to dashboard" : "Sign in";

  return (
    <section className="relative py-24 sm:py-36 overflow-hidden">
      <div className="section-bg fade-both">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/cta-glow.png" alt="" aria-hidden="true" loading="lazy" />
      </div>
      <div className="section-bg bg-cta-glow" />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8">
        <div className="h-px bg-edge/30 mb-24 sm:mb-32" />

        <div className="max-w-[480px]">
          <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-8">
            {authed ? "Your workspace" : "Get started"}
          </p>
          <h2 className="font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-5">
            From scattered papers to structured judgment
          </h2>
          <p className="font-sans text-[14px] leading-[1.7] text-sub mb-10">
            {authed
              ? "Your research workspace is ready. Continue where you left off or start a new structured analysis."
              : "Sign in to start building evidence-grounded synthesis from your sources."}
          </p>

          <Link
            href={ctaHref}
            className="inline-flex items-center font-sans text-[14px] font-medium px-8 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
          >
            {ctaLabel}
          </Link>
          {!authed && (
            <p className="mt-4 font-sans text-[12px] text-mute tracking-wide">
              Free during research preview &middot; No credit card required
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
