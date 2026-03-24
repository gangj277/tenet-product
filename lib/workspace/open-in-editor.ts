import path from "node:path";
import { spawn } from "node:child_process";

export type OpenInEditorResult = {
  ok: boolean;
  mode?: "cursor" | "vscode" | "default" | "revealed";
  error?: string;
};

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: false,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function revealPath(filePath: string): Promise<void> {
  if (process.platform === "darwin") {
    await runCommand("open", ["-R", filePath]);
    return;
  }

  if (process.platform === "win32") {
    await runCommand("explorer", ["/select,", filePath]);
    return;
  }

  await runCommand("xdg-open", [path.dirname(filePath)]);
}

export async function openLocalPathInEditor(
  filePath: string
): Promise<OpenInEditorResult> {
  if (!path.isAbsolute(filePath)) {
    return { ok: false, error: "Expected an absolute file path." };
  }

  const attempts: Array<{
    mode: "cursor" | "vscode" | "default";
    run: () => Promise<void>;
  }> = [];

  if (process.platform === "darwin") {
    attempts.push({
      mode: "cursor",
      run: () => runCommand("open", ["-a", "Cursor", filePath]),
    });
    attempts.push({
      mode: "vscode",
      run: () => runCommand("open", ["-a", "Visual Studio Code", filePath]),
    });
    attempts.push({
      mode: "default",
      run: () => runCommand("open", [filePath]),
    });
  } else if (process.platform === "win32") {
    attempts.push({
      mode: "cursor",
      run: () => runCommand("cursor", ["-g", filePath]),
    });
    attempts.push({
      mode: "vscode",
      run: () => runCommand("code", ["-g", filePath]),
    });
    attempts.push({
      mode: "default",
      run: () => runCommand("cmd", ["/c", "start", "", filePath]),
    });
  } else {
    attempts.push({
      mode: "cursor",
      run: () => runCommand("cursor", ["-g", filePath]),
    });
    attempts.push({
      mode: "vscode",
      run: () => runCommand("code", ["-g", filePath]),
    });
    attempts.push({
      mode: "default",
      run: () => runCommand("xdg-open", [filePath]),
    });
  }

  let lastError: string | null = null;
  for (const attempt of attempts) {
    try {
      await attempt.run();
      return { ok: true, mode: attempt.mode };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  try {
    await revealPath(filePath);
    return {
      ok: true,
      mode: "revealed",
      ...(lastError ? { error: lastError } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : lastError ?? "Unable to open the file in an editor.",
    };
  }
}
