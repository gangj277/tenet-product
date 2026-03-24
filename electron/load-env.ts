import fs from "fs";
import path from "path";

function parseEnvContents(contents: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function loadAppEnv(cwd = process.cwd()): Record<string, string> {
  const nodeEnv = process.env.NODE_ENV || "development";
  const filenames = [
    ".env",
    `.env.${nodeEnv}`,
    nodeEnv === "test" ? null : ".env.local",
    `.env.${nodeEnv}.local`,
  ].filter((value): value is string => Boolean(value));

  const loaded: Record<string, string> = {};

  for (const filename of filenames) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    Object.assign(loaded, parseEnvContents(fs.readFileSync(filePath, "utf8")));
  }

  return {
    ...loaded,
    ...(process.env as Record<string, string | undefined>),
  } as Record<string, string>;
}
