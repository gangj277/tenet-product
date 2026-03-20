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

  const ctaHref = authed ? "/dashboard" : "/auth/login";
  const ctaLabel = authed ? "Go to dashboard" : "Sign in";
  const navLabel = authed ? "Dashboard" : "Sign in";

  return (
    <main className="relative grain">
      {/* ═══════════════════════════════════════
          NAVIGATION
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

      {/* ═══════════════════════════════════════
          HERO — calm supremacy + recognition
          ═══════════════════════════════════════ */}
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
          THE SHIFT — empathetic recognition, not lecturing
          ═══════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="section-bg fade-both">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/mid-ambient.png" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="section-bg bg-mid-ambient" />

        <div className="relative z-10 max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="max-w-[640px]">
            <h2 className="font-serif text-[clamp(1.6rem,3.5vw,2.6rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-8">
              You spend a weekend reading thirty papers. Monday morning, you still
              can&apos;t articulate what the evidence actually says.
            </h2>
            <p className="font-sans text-[15px] leading-[1.75] text-sub max-w-[54ch] mb-6">
              The notes are scattered across five apps. The contradictions you noticed
              on page twelve are buried somewhere. You know the literature has gaps,
              but you can&apos;t map exactly where.
            </p>
            <p className="font-sans text-[15px] leading-[1.75] text-sub max-w-[54ch] mb-6">
              Generic AI makes this worse &mdash; plausible-sounding summaries with
              no provenance, no tension, no uncertainty. What you need isn&apos;t
              another summary.
            </p>
            <p className="font-sans text-[16px] leading-[1.6] text-heading max-w-[54ch]">
              It&apos;s{" "}
              <em className="not-italic text-accent">structured inference</em>{" "}
              from your actual evidence.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          THE WORKSPACE — unified 3-panel mockup
          ═══════════════════════════════════════ */}
      <section id="artifacts" className="relative py-24 sm:py-36 overflow-hidden scroll-mt-24">
        <div className="section-bg fade-both">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/agent-glow.png" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="section-bg bg-workspace-atmosphere" />

        <div className="relative z-10 max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section intro */}
          <div className="max-w-[640px] mb-14 sm:mb-20">
            <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-6">
              The workspace
            </p>
            <h2 className="font-serif text-[clamp(1.5rem,3vw,2.4rem)] leading-[1.15] tracking-[-0.02em] text-heading mb-5">
              Sources, synthesis, and an AI partner &mdash;{" "}
              <em className="not-italic text-accent">in one view</em>
            </h2>
            <p className="font-sans text-[15px] leading-[1.75] text-sub max-w-[52ch]">
              Every source you upload lives alongside the structured artifacts Lumen
              produces. A workspace agent &mdash; grounded in your evidence, not the
              open internet &mdash; sits beside your work, ready to challenge, extend,
              or refine your thinking.
            </p>
          </div>

          {/* ── Workspace mockup ── */}
          <div className="workspace-mockup">
            {/* Chrome bar */}
            <div className="workspace-chrome">
              <div className="workspace-chrome-dots">
                <span className="workspace-chrome-dot" style={{ background: "#ff5f57" }} />
                <span className="workspace-chrome-dot" style={{ background: "#febc2e" }} />
                <span className="workspace-chrome-dot" style={{ background: "#28c840" }} />
              </div>
              <span className="workspace-chrome-title">model-collapse-research</span>
            </div>

            {/* 3-panel body */}
            <div className="workspace-body">
              {/* ── Left: Sidebar ── */}
              <div className="workspace-sidebar">
                <div className="workspace-sidebar-label">Artifacts</div>
                {[
                  { name: "synthesis.md", active: true },
                  { name: "claims.md", active: false },
                  { name: "gaps.md", active: false },
                  { name: "next-steps.md", active: false },
                ].map((file) => (
                  <div
                    key={file.name}
                    className={`workspace-sidebar-file ${file.active ? "active" : ""}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: file.active ? 0.8 : 0.45 }}>
                      <path d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.1" />
                    </svg>
                    {file.name}
                  </div>
                ))}

                <div className="workspace-sidebar-label">Sources</div>
                {[
                  { name: "shumailov-2023.pdf" },
                  { name: "alemohammad-2023.pdf" },
                  { name: "dohmatob-2024.pdf" },
                ].map((file) => (
                  <div key={file.name} className="workspace-sidebar-file">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
                      <path d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M5.5 9h5M5.5 11h3" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
                    </svg>
                    {file.name}
                  </div>
                ))}
              </div>

              {/* ── Center: Document viewer ── */}
              <div className="workspace-viewer">
                <div className="workspace-viewer-tabs">
                  <div className="workspace-viewer-tab">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-50">
                      <path d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.1" />
                    </svg>
                    synthesis.md
                  </div>
                </div>

                <div className="workspace-viewer-content synthesis-doc">
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
                    prevents collapse across all tested model families.
                  </p>

                  <p className="mt-4 text-[12px] text-dim leading-relaxed">
                    3 sources analyzed &middot; 2 uploaded, 1 discovered &middot; High confidence on mechanism, moderate on long-term prognosis
                  </p>
                </div>
              </div>

              {/* ── Right: Chat agent ── */}
              <div className="workspace-chat">
                <div className="workspace-chat-header">
                  <div className="workspace-chat-dot" />
                  <span className="font-mono text-[12px] text-sub relative z-[1]">
                    Workspace Agent
                  </span>
                </div>

                <div className="workspace-chat-messages">
                  {/* User message */}
                  <div className="workspace-chat-msg-user">
                    Challenge my hypothesis that model collapse is inevitable.
                    What&apos;s the strongest counterargument?
                  </div>

                  {/* Agent response */}
                  <div className="workspace-chat-msg-agent">
                    <p style={{ marginBottom: 8 }}>
                      The strongest counterargument comes from Dohmatob et al.
                      Their Theorem 3.1 shows collapse requires{" "}
                      <strong className="text-heading font-medium">closed-loop</strong>{" "}
                      training &mdash; but production systems almost never operate this way.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span className="text-accent" style={{ flexShrink: 0, fontWeight: 500 }}>1.</span>
                        <span>
                          Data mixing with 10% fresh human data prevents collapse in all tested scenarios.{" "}
                          <span className="workspace-chat-cite">[dohmatob-2024, Table 2]</span>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span className="text-accent" style={{ flexShrink: 0, fontWeight: 500 }}>2.</span>
                        <span>
                          Curation filters preserve distributional coverage across 50+ generations.{" "}
                          <span className="workspace-chat-cite">[alemohammad-2023, Fig 7]</span>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span className="text-accent" style={{ flexShrink: 0, fontWeight: 500 }}>3.</span>
                        <span>
                          Multi-model ensembles show no measurable drift after 50 generations.{" "}
                          <span className="workspace-chat-cite">[workshop-2024]</span>
                        </span>
                      </div>
                    </div>

                    <div className="workspace-chat-confidence">
                      Confidence: High for delay, moderate for full prevention.
                    </div>
                  </div>
                </div>

                <div className="workspace-chat-input">
                  <div className="workspace-chat-input-field">
                    Ask about your research&hellip;
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile hint bar */}
            <div className="workspace-mobile-hint">
              <div className="workspace-mobile-hint-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
                  <path d="M2 4h4v8H2zM8 4h6" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                Sidebar
              </div>
              <div className="workspace-mobile-hint-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
                  <path d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                Viewer
              </div>
              <div className="workspace-mobile-hint-item">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
                  <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
                  <path d="M3 4h10v8H3z" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                Agent
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS — 3-step workflow journey
          ═══════════════════════════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-20 sm:mb-28" />

          <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-14">
            How it works
          </p>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6">
            <div className="hidden sm:block absolute top-[28px] left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-px bg-edge/40" aria-hidden="true" />

            {[
              {
                step: "01",
                title: "Drop your sources",
                desc: "Upload PDFs, paste links, or describe a research question. Lumen ingests, indexes, and discovers relevant literature.",
              },
              {
                step: "02",
                title: "Ask your question",
                desc: "Frame the question you\u2019re actually trying to answer. Lumen builds a structured project around it \u2014 not a summary, a workspace.",
              },
              {
                step: "03",
                title: "Get structured synthesis",
                desc: "Receive tracked claims, visible contradictions, evidence maps, gap analysis, and an AI partner to develop your thesis.",
              },
            ].map((item, i) => (
              <div key={item.step} className="hiw-card group relative">
                <div className="relative z-10 flex items-center gap-3 mb-5">
                  <span className="flex items-center justify-center w-[56px] h-[56px] rounded-full border border-edge/50 group-hover:border-accent/40 bg-page/80 transition-all duration-400">
                    <span className="font-mono text-[13px] text-accent tracking-wide">{item.step}</span>
                  </span>
                  {i < 2 && (
                    <div className="sm:hidden absolute left-[28px] top-[56px] w-px h-[calc(100%+16px)] bg-edge/30" aria-hidden="true" />
                  )}
                </div>
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
          QUALITY — what sets Lumen apart
          ═══════════════════════════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-20 sm:mb-28" />

          <p className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dim mb-14">
            Built for rigor
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {[
              {
                title: "Evidence, not assertion",
                desc: "Every claim in a Lumen synthesis is source-traceable. If the evidence is weak, Lumen says so. If sources contradict, Lumen surfaces the tension.",
              },
              {
                title: "Inference, not imitation",
                desc: "Lumen doesn\u2019t paraphrase your papers back at you. It performs structured inference \u2014 connecting findings across sources, identifying patterns, and flagging where the reasoning depends on assumptions.",
              },
              {
                title: "Uncertainty, not confidence",
                desc: "Generic AI sounds confident about everything. Lumen labels confidence levels, distinguishes well-supported claims from speculative ones, and shows you where the literature is thin.",
              },
            ].map((item) => (
              <div key={item.title} className="hiw-card-body rounded-lg p-5 sm:p-6">
                <h3 className="font-serif text-[17px] tracking-[-0.01em] text-heading mb-2.5 leading-snug">
                  {item.title}
                </h3>
                <p className="font-sans text-[13.5px] leading-[1.7] text-sub">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIAL — attributed quote
          ═══════════════════════════════════════ */}
      <section className="py-28 sm:py-36">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-8">
          <div className="h-px bg-edge/30 mb-28 sm:mb-36" />

          <div className="max-w-[640px] mx-auto text-center">
            <div className="flex justify-center mb-10">
              <div className="decorative-diamond" />
            </div>

            <blockquote className="font-serif text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.3] tracking-[-0.015em] text-heading mb-8">
              &ldquo;This synthesis is better than what I&apos;d write after a
              weekend of reading.&rdquo;
            </blockquote>

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
          CTA — sign in
          ═══════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════ */}
      <footer className="relative py-10 border-t border-edge/30">
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
            Lumen
          </span>
          <p className="font-sans text-[12px] text-mute">
            Research that shows its work.
          </p>
        </div>
      </footer>
    </main>
  );
}
