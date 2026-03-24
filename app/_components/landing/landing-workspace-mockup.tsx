export default function LandingWorkspaceMockup() {
  return (
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
  );
}
