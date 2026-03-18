"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  const ctaHref = authed ? "/dashboard" : "/auth/signup";
  const ctaLabel = authed ? "Go to dashboard" : "Request early access";
  const navLabel = authed ? "Dashboard" : "Sign in";

  return (
    <main className="relative grain">
      {/* ═══════════════════════════════════════
          NAVIGATION — stronger blur + subtle border
          ═══════════════════════════════════════ */}
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
            Tenet
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
      </nav>

      {/* ═══════════════════════════════════════
          HERO — problem-recognition + two CTAs
          ═══════════════════════════════════════ */}
      <section className="relative min-h-[100svh] flex flex-col justify-end pb-16 sm:pb-24 md:pb-32 pt-32 overflow-hidden">
        {/* Atmospheric background layer: generated image + CSS gradient overlay */}
        <div className="section-bg fade-bottom">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero-bg.png" alt="" aria-hidden="true" />
        </div>
        <div className="section-bg bg-hero-atmosphere" />

        <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8 w-full">
          <h1 className="reveal font-serif font-normal text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.035em] text-heading max-w-[20ch]">
            You&apos;ve read the papers.{" "}
            <em className="not-italic text-accent">Now what does the evidence say?</em>
          </h1>

          <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row sm:items-end justify-between gap-10">
            <p className="reveal reveal-delay-1 font-sans text-[15px] sm:text-base leading-relaxed text-sub max-w-[46ch]">
              Tenet is the AI-native research workspace that turns rough questions
              into structured synthesis &mdash; with tracked claims, visible
              contradictions, evidence maps, and an AI partner grounded in your
              sources.
            </p>

            <div className="reveal reveal-delay-2 flex items-center gap-4 self-start sm:self-auto">
              <Link
                href={ctaHref}
                className="inline-flex items-center font-sans text-[14px] font-medium px-7 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
              >
                {ctaLabel}
              </Link>
              <a
                href="#specimen"
                className="group inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-sub hover:text-heading transition-colors duration-300 whitespace-nowrap"
              >
                <span className="border-b border-edge/0 group-hover:border-sub/40 transition-all duration-300 pb-px">See the synthesis</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="translate-y-px group-hover:translate-y-[3px] transition-transform duration-300" aria-hidden="true">
                  <path d="M8 3v8.5M4.5 8.5L8 12l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Thin rule as a quiet hero closer */}
          <div className="reveal reveal-delay-3 mt-16 sm:mt-20 h-px bg-edge/60" />
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TRUST BLOCK — institutional logos
          ═══════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mute text-center mb-8">
            Trusted by researchers at
          </p>
          <div className="flex items-center justify-center flex-wrap">
            {/* eslint-disable @next/next/no-img-element */}
            <div className="trust-logo-wrap px-6 sm:px-8">
              <img src="/images/logos/uoft.svg" alt="University of Toronto" className="h-[30px] sm:h-[34px] opacity-35 hover:opacity-60 transition-all duration-400 trust-logo" />
            </div>
            <div className="trust-sep" aria-hidden="true" />
            <div className="trust-logo-wrap px-6 sm:px-8">
              <img src="/images/logos/yonsei.svg" alt="Yonsei University" className="h-[26px] sm:h-[30px] opacity-35 hover:opacity-60 transition-all duration-400 trust-logo" />
            </div>
            <div className="trust-sep" aria-hidden="true" />
            <div className="trust-logo-wrap px-6 sm:px-8">
              <img src="/images/logos/snu.svg" alt="Seoul National University" className="h-[32px] sm:h-[36px] opacity-35 hover:opacity-60 transition-all duration-400 trust-logo" />
            </div>
            <div className="trust-sep" aria-hidden="true" />
            <div className="trust-logo-wrap px-6 sm:px-8">
              <img src="/images/logos/kaist.svg" alt="KAIST" className="h-[22px] sm:h-[25px] opacity-35 hover:opacity-60 transition-all duration-400 trust-logo" />
            </div>
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          EDITORIAL PASSAGE (THE PROBLEM) — ambient bg + fade-both
          ═══════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="section-bg fade-both">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/mid-ambient.png" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="section-bg bg-mid-ambient" />

        <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="max-w-[640px]">
            <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-8">
              The problem
            </p>
            <h2 className="font-serif text-[clamp(1.6rem,3.5vw,2.6rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-8">
              You spend a weekend reading thirty papers. Monday morning, you still
              can&apos;t articulate what the evidence actually says.
            </h2>
            <p className="font-sans text-[15px] leading-[1.75] text-sub max-w-[54ch] mb-6">
              The notes are scattered across five apps. The contradictions you noticed
              on page twelve are buried somewhere. You know the literature has gaps,
              but you can&apos;t map exactly where.
            </p>
            <p className="font-sans text-[15px] leading-[1.75] text-sub max-w-[54ch]">
              Generic AI makes this worse &mdash; plausible-sounding summaries with
              no provenance, no tension, no uncertainty. What you need isn&apos;t
              more information. It&apos;s{" "}
              <em className="text-heading not-italic">structured judgment</em>.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SYNTHESIS SPECIMEN — glass-panel card + glow-accent
          ═══════════════════════════════════════ */}
      <section id="specimen" className="py-24 sm:py-32 scroll-mt-24">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            {/* Left: label + description */}
            <div className="lg:w-[280px] flex-shrink-0">
              <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-5">
                What Tenet produces
              </p>
              <h2 className="font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-5">
                Synthesis, not summaries
              </h2>
              <p className="font-sans text-[14px] leading-[1.7] text-sub mb-8">
                From a rough question, Tenet builds a full research workspace:
                evidence-grounded synthesis, tracked claims with citations, visible
                contradictions, identified gaps, and concrete next steps.
              </p>

              {/* File tree */}
              <div className="space-y-1.5">
                <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-3">
                  Project files
                </p>
                {[
                  { name: "synthesis.md", active: true },
                  { name: "claims.md", active: false },
                  { name: "gaps.md", active: false },
                  { name: "next-steps.md", active: false },
                  { name: "sources/", active: false },
                ].map((file) => (
                  <div
                    key={file.name}
                    className={`font-mono text-[12.5px] py-1 ${
                      file.active
                        ? "text-accent"
                        : "text-dim"
                    }`}
                  >
                    {file.active && <span className="mr-1.5">&rsaquo;</span>}
                    {file.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: the actual synthesis specimen — glass + glow */}
            <div className="flex-1 min-w-0">
              <div className="glass-panel glow-accent rounded-lg overflow-hidden">
                {/* Document title bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-edge/30">
                  <span className="font-mono text-[12px] text-sub">
                    synthesis.md
                  </span>
                  <span className="font-mono text-[11px] text-dim">
                    model-collapse-research
                  </span>
                </div>

                {/* Document content */}
                <div className="p-5 sm:p-7 lg:p-9 synthesis-doc">
                  <h2>Is model collapse an inevitable risk for AI training?</h2>

                  <p>
                    The evidence suggests model collapse is a real but{" "}
                    <em>conditional</em> risk. Shumailov et al. (2023) demonstrate
                    that recursive training on model-generated data produces
                    measurable distributional drift, but the conditions under which
                    this becomes catastrophic remain narrower than popular accounts
                    suggest.
                  </p>
                  <p className="cite">
                    [shumailov-2023.pdf, Section 4.2]
                  </p>

                  <p>
                    Alemohammad et al. (2023) introduce the concept of &ldquo;model
                    autophagy disorder,&rdquo; showing progressive quality degradation
                    across generations. However, their framework assumes a closed-loop
                    training regime that most production systems deliberately avoid.
                  </p>
                  <p className="cite">
                    [alemohammad-2023.pdf, Section 3]
                  </p>

                  <div className="tension">
                    <p>
                      <strong className="text-heading font-medium">Key tension:</strong>{" "}
                      Theoretical results demonstrate inevitable tail-distribution
                      loss, while empirical mitigation strategies (data mixing,
                      curation) show collapse can be substantially delayed. The
                      question is whether &ldquo;delayed&rdquo; means &ldquo;solved&rdquo;
                      or merely &ldquo;deferred.&rdquo;
                    </p>
                    <p className="cite">
                      [dohmatob-2024.pdf, Theorem 3.1]
                    </p>
                  </div>

                  <h2>Mitigation landscape</h2>
                  <p>
                    Three classes of mitigation appear in the literature: data provenance
                    tracking, synthetic-data filtering, and mixed training regimes.
                    Dohmatob et al. show that mixing as little as 10% fresh human data
                    prevents collapse across all tested model families. However, this
                    assumes ongoing access to human-generated data at scale &mdash; an
                    assumption that weakens over time.
                  </p>

                  <p className="mt-4 text-[12px] text-dim leading-relaxed">
                    3 sources analyzed &middot; 2 uploaded, 1 discovered &middot; High confidence on mechanism, moderate on long-term prognosis
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          THE WORKSPACE AGENT — violet glow bg + glass card
          ═══════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="section-bg fade-both">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/agent-glow.png" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="section-bg bg-agent-glow" />

        <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8">
          {/* Thin rule */}
          <div className="h-px bg-edge/30 mb-24 sm:mb-32" />

          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
            {/* Narrative text */}
            <div className="lg:w-[440px] flex-shrink-0">
              <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-8">
                The workspace agent
              </p>
              <h2 className="font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-8">
                Your judgment, amplified &mdash; not replaced
              </h2>
              <p className="font-sans text-[15px] leading-[1.75] text-sub mb-6">
                After Tenet builds your project, a workspace agent stays with you.
                It has read every source, every claim, every contradiction. Ask it
                to challenge your hypothesis, and it argues from your own evidence.
                Ask for gaps, and it shows you where your literature is thin.
              </p>
              <p className="font-sans text-[15px] leading-[1.75] text-sub mb-6">
                It finds new sources and weighs them against what you already have.
                It updates your synthesis while preserving provenance. This is not
                a general-purpose chatbot &mdash; it is grounded entirely in your
                project context, your sources, your evidence.
              </p>
              <p className="font-sans text-[14px] leading-[1.7] text-dim italic">
                &ldquo;Challenge my hypothesis that model collapse is inevitable.
                What&apos;s the strongest counterargument from the evidence?&rdquo;
              </p>
            </div>

            {/* Agent response specimen — glass + violet glow */}
            <div className="flex-1 min-w-0">
              <div className="glass-panel glow-violet rounded-lg overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3 border-b border-edge/30">
                  <div className="w-[6px] h-[6px] rounded-full bg-dot animate-pulse" />
                  <span className="font-mono text-[12px] text-sub">
                    Workspace Agent
                  </span>
                </div>

                <div className="p-5 sm:p-7 lg:p-9">
                  <p className="font-sans text-[14px] leading-[1.75] text-body mb-5">
                    The strongest counterargument comes from Dohmatob et al. (2024).
                    Their Theorem 3.1 shows collapse requires <em className="text-heading">closed-loop</em>{" "}
                    training &mdash; but production systems almost never operate this way.
                  </p>

                  <div className="space-y-4 mb-5">
                    <div className="flex gap-3">
                      <span className="font-serif text-[14px] text-accent leading-[1.75] flex-shrink-0">1.</span>
                      <p className="font-sans text-[13.5px] leading-[1.75] text-sub">
                        Data mixing with 10% fresh human data prevents collapse in all
                        tested scenarios.{" "}
                        <span className="text-cite text-[11px]">[dohmatob-2024, Table 2]</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-serif text-[14px] text-accent leading-[1.75] flex-shrink-0">2.</span>
                      <p className="font-sans text-[13.5px] leading-[1.75] text-sub">
                        Curation filters on synthetic data preserve distributional coverage
                        across 50+ generations.{" "}
                        <span className="text-cite text-[11px]">[alemohammad-2023, Fig 7]</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-serif text-[14px] text-accent leading-[1.75] flex-shrink-0">3.</span>
                      <p className="font-sans text-[13.5px] leading-[1.75] text-sub">
                        Multi-model ensembles show no measurable drift after 50 generations.{" "}
                        <span className="text-cite text-[11px]">[workshop-2024]</span>
                      </p>
                    </div>
                  </div>

                  <p className="font-sans text-[13px] leading-[1.7] text-dim italic">
                    Confidence: High for delay, moderate for full prevention. The
                    tail-risk argument remains theoretically unresolved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS — 3-step clarity
          ═══════════════════════════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-20 sm:mb-28" />

          <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-14">
            How it works
          </p>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6">
            {/* Connecting line (desktop only) */}
            <div className="hidden sm:block absolute top-[28px] left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-px bg-edge/40" aria-hidden="true" />

            {[
              {
                step: "01",
                title: "Upload your sources",
                desc: "Drop PDFs, paste links, or point Tenet at a research question. It ingests and indexes everything.",
              },
              {
                step: "02",
                title: "Ask your question",
                desc: "Frame the question you\u2019re actually trying to answer. Tenet builds a structured project around it.",
              },
              {
                step: "03",
                title: "Get grounded synthesis",
                desc: "Receive a workspace with tracked claims, visible contradictions, evidence maps, and an AI partner to develop your thesis.",
              },
            ].map((item, i) => (
              <div key={item.step} className="hiw-card group relative">
                {/* Step number node */}
                <div className="relative z-10 flex items-center gap-3 mb-5">
                  <span className="flex items-center justify-center w-[56px] h-[56px] rounded-full border border-edge/50 group-hover:border-accent/40 bg-page/80 transition-all duration-400">
                    <span className="font-mono text-[13px] text-accent tracking-wide">{item.step}</span>
                  </span>
                  {/* Mobile step connector */}
                  {i < 2 && (
                    <div className="sm:hidden absolute left-[28px] top-[56px] w-px h-[calc(100%+16px)] bg-edge/30" aria-hidden="true" />
                  )}
                </div>
                {/* Card body */}
                <div className="hiw-card-body rounded-lg p-5 sm:p-6 transition-all duration-400">
                  <h3 className="font-serif text-[17px] tracking-[-0.01em] text-heading mb-2.5 leading-snug">
                    {item.title}
                  </h3>
                  <p className="font-sans text-[13.5px] leading-[1.7] text-sub">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          QUALITY TESTIMONIAL — attributed quote + diamond
          ═══════════════════════════════════════ */}
      <section className="py-28 sm:py-36">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-28 sm:mb-36" />

          <div className="max-w-[640px] mx-auto text-center">
            {/* Decorative diamond */}
            <div className="flex justify-center mb-10">
              <div className="decorative-diamond" />
            </div>

            <blockquote className="font-serif text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.3] tracking-[-0.015em] text-heading mb-8">
              &ldquo;This synthesis is better than what I&apos;d write after a
              weekend of reading.&rdquo;
            </blockquote>

            {/* Editorial attribution */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className="block w-8 h-px bg-accent/40" />
              <p className="font-sans text-[12px] tracking-[0.06em] uppercase text-dim">
                Early research preview participant
              </p>
              <span className="block w-8 h-px bg-accent/40" />
            </div>

            <p className="font-sans text-[14px] leading-[1.75] text-dim max-w-[52ch] mx-auto">
              Every claim is source-traceable. Contradictions are surfaced, not
              buried. Weak evidence is labeled weak. If an output could apply to
              a hundred different topics with minor wording changes, it has failed.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA — warm glow bg + early access framing
          ═══════════════════════════════════════ */}
      <section id="access" className="relative py-24 sm:py-36 overflow-hidden">
        <div className="section-bg fade-both">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cta-glow.png" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="section-bg bg-cta-glow" />

        <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-24 sm:mb-32" />

          <div className="max-w-[480px]">
            <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-8">
              {authed ? "Your workspace" : "Early access"}
            </p>
            <h2 className="font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-5">
              From scattered papers to structured judgment
            </h2>
            <p className="font-sans text-[14px] leading-[1.7] text-sub mb-10">
              {authed
                ? "Your research workspace is ready. Continue where you left off or start a new structured analysis."
                : "Tenet is in research preview. Request early access and be among the first researchers to use evidence-grounded synthesis."}
            </p>

            <div className="flex items-center gap-4">
              <Link
                href={ctaHref}
                className="inline-flex items-center font-sans text-[14px] font-medium px-8 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
              >
                {ctaLabel}
              </Link>
              {!authed && authed !== null && (
                <Link
                  href="/auth/login"
                  className="font-sans text-[13px] font-medium text-sub hover:text-heading transition-colors duration-300"
                >
                  Sign in
                </Link>
              )}
            </div>
            {!authed && (
              <p className="mt-4 font-sans text-[12px] text-mute tracking-wide">
                Free during research preview &middot; No credit card required
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER — softer border + gradient fade-in
          ═══════════════════════════════════════ */}
      <footer className="relative py-10 border-t border-edge/30">
        {/* Subtle gradient fade-in above footer */}
        <div className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-page pointer-events-none" />

        <div className="max-w-[1080px] mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-serif text-[14px] text-dim">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="text-accent opacity-50">
              <defs>
                <clipPath id="foot-clip"><circle cx="20" cy="16" r="10.5"/></clipPath>
              </defs>
              <circle cx="12" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.3" opacity="0.28"/>
              <circle cx="20" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.3" opacity="0.28"/>
              <circle cx="12" cy="16" r="10.5" fill="currentColor" opacity="0.07" clipPath="url(#foot-clip)"/>
              <path d="M16 5.87A10.5 10.5 0 0 0 16 26.13" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.55"/>
              <path d="M16 5.87A10.5 10.5 0 0 1 16 26.13" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.55"/>
              <circle cx="16" cy="16" r="2.2" fill="currentColor" opacity="0.85"/>
            </svg>
            Tenet
          </span>
          <p className="font-sans text-[12px] text-mute">
            Your evidence. Structured.
          </p>
        </div>
      </footer>
    </main>
  );
}
