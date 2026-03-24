"use client";

const GITHUB_REPO = "https://github.com/gangj277/tenet-product";
const QUICKSTART_URL = `${GITHUB_REPO}#primary-install-path`;
const RELEASES_URL = `${GITHUB_REPO}/releases/latest`;

export function DownloadButton() {
  return (
    <div className="relative">
      <a
        href={QUICKSTART_URL}
        className="inline-flex items-center gap-2.5 font-sans text-[14px] font-medium px-7 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v12m6-6H6"
          />
        </svg>
        Run locally from GitHub
      </a>

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="font-sans text-[11px] text-dim/70">
          `npx degit` · `npm install` · `npm run electron:local`
        </span>
        <a
          href={RELEASES_URL}
          className="font-sans text-[11px] text-dim hover:text-sub transition-colors"
        >
          Desktop preview releases
        </a>
      </div>
    </div>
  );
}
