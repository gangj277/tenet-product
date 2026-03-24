"use client";

import { useEffect, useState } from "react";

type Platform = "mac" | "windows" | "linux" | "unknown";

const GITHUB_REPO = "gangj277/tenet-product";
const RELEASE_TAG = "latest";

function getDownloadUrl(platform: Platform): string {
  const base = `https://github.com/${GITHUB_REPO}/releases/${RELEASE_TAG}/download`;
  switch (platform) {
    case "mac":
      return `${base}/Lumen.dmg`;
    case "windows":
      return `${base}/Lumen-Setup.exe`;
    case "linux":
      return `${base}/Lumen.AppImage`;
    default:
      return `https://github.com/${GITHUB_REPO}/releases/${RELEASE_TAG}`;
  }
}

function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "mac":
      return "Download for Mac";
    case "windows":
      return "Download for Windows";
    case "linux":
      return "Download for Linux";
    default:
      return "Download Lumen";
  }
}

function getPlatformIcon(platform: Platform) {
  switch (platform) {
    case "mac":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      );
    case "windows":
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
        </svg>
      );
    case "linux":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.348 1.884 1.348.075 0 .15-.006.225-.02.96-.249 1.38-1.478 1.44-2.072.07-.665.07-1.391.07-1.391l.324-.009c.164-.004.328-.005.49.004.054.004.109.012.163.016.036.004.07.014.107.02.149.041.298.093.44.162.039.017.078.033.118.048.186.092.368.2.54.323.02.014.04.028.06.042.123.093.236.199.344.315.031.034.063.068.093.104.106.131.213.265.315.412a.18.18 0 01.029.046c.108.178.149.368.173.474.119.53.375.799.798.799.305 0 .715-.165 1.15-.6.463-.464.87-1.066 1.047-1.478a2.63 2.63 0 00.178-.614.58.58 0 01.035-.128c.023-.04.052-.082.082-.124.236-.31.464-.586.645-.891.175-.308.353-.644.326-1.116-.03-.53-.242-.79-.577-.983a1.12 1.12 0 00-.263-.096c.01-.164.005-.33-.02-.498-.028-.186-.063-.373-.106-.557-.085-.37-.175-.732-.162-.98.013-.247.118-.505.291-.83.098-.181.224-.389.37-.606.283-.419.634-.9.87-1.467l.002-.003c.126-.28.224-.576.273-.916.049-.334.052-.7-.012-1.113-.073-.478-.258-.949-.553-1.334a3.57 3.57 0 00-.398-.43c-.146-.131-.303-.238-.463-.319a2.108 2.108 0 00-.517-.18c-.165-.037-.334-.043-.5-.021-.308.04-.598.17-.832.378a3.09 3.09 0 00-.396.426 5.3 5.3 0 00-.364.548c-.205.363-.392.762-.573 1.037a1.83 1.83 0 01-.113.156c-.044.053-.095.102-.154.144-.058.04-.125.073-.199.098a.72.72 0 01-.245.047c-.07 0-.14-.006-.208-.017a2.28 2.28 0 01-.406-.102c-.078-.03-.153-.064-.224-.104-.137-.078-.249-.177-.331-.293-.085-.119-.14-.258-.163-.413a3.35 3.35 0 01-.019-.49c.008-.162.025-.32.057-.471.074-.356.207-.642.376-.837.091-.107.2-.194.327-.265.127-.07.27-.118.428-.142.15-.024.314-.023.488.003.346.05.72.2 1.093.413.374.212.73.501 1.085.826a5.57 5.57 0 01.502.52c.128.143.245.297.368.444.252.303.496.641.669.955.344.633.602 1.378.602 2.193a5.52 5.52 0 01-.063.824c-.054.344-.153.672-.299.987l-.002.003a8.2 8.2 0 01-.87 1.463c-.147.215-.272.426-.37.608-.173.326-.276.58-.289.824-.013.247.077.61.162.978.043.186.079.372.106.558.024.168.03.334.02.497.09.04.177.094.255.161.335.191.548.453.577.981.027.472-.15.809-.326 1.115-.182.307-.409.582-.646.893a1.256 1.256 0 00-.082.123.62.62 0 00-.034.128c-.022.074-.06.164-.09.24a4.26 4.26 0 01-.275.601" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      );
  }
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export function DownloadButton() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const otherPlatforms: Platform[] = (["mac", "windows", "linux"] as const).filter(
    (p) => p !== platform
  );

  return (
    <div className="relative">
      <a
        href={getDownloadUrl(platform)}
        className="inline-flex items-center gap-2.5 font-sans text-[14px] font-medium px-7 py-3.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-hover transition-all duration-300 whitespace-nowrap glow-accent-sm hover:glow-accent"
      >
        {getPlatformIcon(platform)}
        {getPlatformLabel(platform)}
      </a>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => setShowAll(!showAll)}
          className="font-sans text-[11px] text-dim hover:text-sub transition-colors cursor-pointer"
        >
          {showAll ? "Hide" : "Other platforms"}
        </button>
        <span className="font-sans text-[11px] text-dim/50">
          v0.1.0 &middot; Free during preview
        </span>
      </div>

      {showAll && (
        <div className="mt-2 flex gap-2">
          {otherPlatforms.map((p) => (
            <a
              key={p}
              href={getDownloadUrl(p)}
              className="inline-flex items-center gap-1.5 font-sans text-[12px] text-sub hover:text-heading px-3 py-1.5 rounded-md border border-edge/40 hover:border-edge/60 hover:bg-edge/10 transition-all"
            >
              {getPlatformIcon(p)}
              {p === "mac" ? "Mac" : p === "windows" ? "Windows" : "Linux"}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
