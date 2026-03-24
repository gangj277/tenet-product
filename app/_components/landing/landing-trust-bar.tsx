export default function LandingTrustBar() {
  return (
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
  );
}
