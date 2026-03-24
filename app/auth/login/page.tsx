"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageBody />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return <LoginPageBody error={error} />;
}

function LoginPageBody({ error }: { error?: string | null } = {}) {
  return (
    <div className="reveal">
      <div className="decorative-diamond mb-8 opacity-50" />

      <h1 className="font-serif text-[clamp(1.6rem,3.5vw,2rem)] leading-[1.2] tracking-[-0.02em] text-heading mb-2">
        Continue with OpenAI
      </h1>
      <p className="font-sans text-[13.5px] leading-[1.65] text-sub mb-10">
        Lumen imports the OpenAI session already connected through Codex on this
        device, then uses that account for sign-in and runtime access.
      </p>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-500/20 bg-red-500/5">
          <p className="font-sans text-[13px] text-red-400">{error}</p>
        </div>
      )}

      <a
        href="/api/auth/openai"
        className="group flex items-center justify-center gap-2.5 w-full font-sans text-[14px] font-medium py-3.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-300"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" fill="currentColor">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
        Continue with OpenAI
      </a>

      <div className="mt-8 px-4 py-4 rounded-xl border border-edge/40 bg-edge/10">
        <p className="font-sans text-[12px] font-medium text-heading mb-1.5">
          Supported flow
        </p>
        <p className="font-sans text-[12.5px] leading-[1.65] text-sub">
          Sign into Codex with the OpenAI account you want to use, then return here
          and continue. If this device is not connected yet, run <code>codex login</code>
          first. Unsupported or expired connections are blocked before a session is
          created.
        </p>
      </div>

      <p className="font-sans text-[13px] text-dim mt-8 text-center">
        Need a new account?{" "}
        <Link
          href="/auth/signup"
          className="text-accent hover:text-accent-hover transition-colors underline underline-offset-[3px] decoration-accent/30"
        >
          Continue with OpenAI
        </Link>
      </p>
    </div>
  );
}
