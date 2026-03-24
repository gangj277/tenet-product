export default function LandingFooter() {
  return (
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
  );
}
