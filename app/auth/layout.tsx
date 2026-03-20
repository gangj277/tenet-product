export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grain flex">
      {/* ── Left: atmospheric panel ── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-ink-950 items-end p-12">
        {/* Layered gradients for depth */}
        <div className="absolute inset-0 bg-hero-atmosphere opacity-40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 30% 70%, rgba(212,168,83,0.08), transparent 70%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-[380px]">
          <div className="decorative-diamond mb-8" />
          <h2 className="font-serif text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.02em] text-white mb-4">
            Research that thinks,
            <br />
            not just retrieves
          </h2>
          <p className="font-sans text-[14px] leading-[1.7] text-ink-100">
            Lumen turns rough questions into structured research workspaces with
            grounded synthesis, tracked claims, and visible contradictions.
          </p>
        </div>
      </div>

      {/* ── Right: form area ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
