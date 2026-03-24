"use client";

import { useEffect, useState } from "react";
import LandingNav from "./_components/landing/landing-nav";
import LandingHero from "./_components/landing/landing-hero";
import LandingTrustBar from "./_components/landing/landing-trust-bar";
import LandingWorkspaceMockup from "./_components/landing/landing-workspace-mockup";
import LandingCta from "./_components/landing/landing-cta";
import LandingFooter from "./_components/landing/landing-footer";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  return (
    <main className="relative grain">
      <LandingNav authed={authed} />

      <LandingHero authed={authed} />

      <LandingTrustBar />

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

      <LandingWorkspaceMockup />

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

      <LandingCta authed={authed} />

      <LandingFooter />
    </main>
  );
}
