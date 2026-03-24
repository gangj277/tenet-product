import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  safeStorage,
  type BrowserWindowConstructorOptions,
} from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { randomBytes } from "crypto";
import { loadAppEnv } from "./load-env";
import {
  getLocalProductionServerLaunchConfig,
  getProductionServerLaunchConfig,
} from "./server-launch";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number = 3000;

const isLocalProduction = process.env.LUMEN_ELECTRON_MODE === "local";
const isDev = !app.isPackaged && !isLocalProduction;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const CHOOSE_WORKSPACE_FOLDER_CHANNEL = "workspace:choose-folder";
const OPEN_PATH_IN_EDITOR_CHANNEL = "workspace:open-path-in-editor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr !== "string") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not get port"));
      }
    });
    srv.on("error", reject);
  });
}

function loadEnvConfig(): Record<string, string> {
  const envPath = path.join(app.getPath("userData"), "env.json");
  if (fs.existsSync(envPath)) {
    try {
      return JSON.parse(fs.readFileSync(envPath, "utf-8"));
    } catch {
      console.warn("Failed to parse env.json, skipping");
    }
  }
  return {};
}

function resolveElectronDataDir(): string {
  const dataDir = path.join(app.getPath("userData"), "lumen-data");
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function resolveEncryptionKey(): string | undefined {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return undefined;
    }

    if (
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    ) {
      console.warn(
        "[electron] safeStorage backend is basic_text; local credential caching will remain disabled."
      );
      return undefined;
    }

    const keyPath = path.join(app.getPath("userData"), "lumen-storage-key.bin");
    if (fs.existsSync(keyPath)) {
      const encrypted = fs.readFileSync(keyPath);
      return safeStorage.decryptString(encrypted);
    }

    const key = randomBytes(32).toString("hex");
    fs.writeFileSync(keyPath, safeStorage.encryptString(key));
    return key;
  } catch (error) {
    console.warn(
      `[electron] Failed to initialize secure local credential storage: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
}

function waitForServer(port: number, timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = net.createConnection({ port, host: "127.0.0.1" }, () => {
        req.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server did not start within ${timeout}ms`));
        } else {
          setTimeout(check, 200);
        }
      });
    };
    check();
  });
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

async function startServer(): Promise<number> {
  const port = await findFreePort();
  const envConfig = loadEnvConfig();
  const dataDir = resolveElectronDataDir();
  const encryptionKey = resolveEncryptionKey();

  const env = {
    ...loadAppEnv(process.cwd()),
    ...process.env,
    ...envConfig,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    ELECTRON: "1",
    LUMEN_DATA_DIR: dataDir,
    LOCAL_BLOB_ROOT: path.join(dataDir, "blob-store"),
    ...(encryptionKey ? { ENCRYPTION_KEY: encryptionKey } : {}),
  };

  if (isDev) {
    // Dev mode: run `next dev` for HMR
    const nextBin = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      "next"
    );
    serverProcess = spawn(nextBin, ["dev", "--port", String(port)], {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    });
  } else {
    const launch = app.isPackaged
      ? getProductionServerLaunchConfig({
          env,
          execPath: process.execPath,
          resourcesPath: process.resourcesPath,
        })
      : getLocalProductionServerLaunchConfig({
          env,
          execPath: process.execPath,
          projectDir: process.cwd(),
        });

    if (!fs.existsSync(launch.args[0] ?? "")) {
      throw new Error(
        "Local production build is missing. Run `npm run build` or use `npm run electron:local`."
      );
    }

    serverProcess = spawn(launch.command, launch.args, {
      env: launch.env,
      cwd: launch.cwd,
      stdio: "pipe",
    });
  }

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`Next.js server exited with code ${code}`);
    serverProcess = null;
  });

  await waitForServer(port);
  return port;
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

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

async function openPathInEditor(filePath: string): Promise<{
  ok: boolean;
  mode?: "cursor" | "vscode" | "default" | "revealed";
  error?: string;
}> {
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
  } else {
    attempts.push({
      mode: "cursor",
      run: () => runCommand("cursor", ["-g", filePath]),
    });
    attempts.push({
      mode: "vscode",
      run: () => runCommand("code", ["-g", filePath]),
    });
  }

  attempts.push({
    mode: "default",
    run: async () => {
      const error = await shell.openPath(filePath);
      if (error) {
        throw new Error(error);
      }
    },
  });

  let lastError: string | null = null;
  for (const attempt of attempts) {
    try {
      await attempt.run();
      return { ok: true, mode: attempt.mode };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  shell.showItemInFolder(filePath);
  return {
    ok: true,
    mode: "revealed",
    ...(lastError ? { error: lastError } : {}),
  };
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  const opts: BrowserWindowConstructorOptions = {
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  mainWindow = new BrowserWindow(opts);
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/dashboard`);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.includes("127.0.0.1")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  ipcMain.handle(CHOOSE_WORKSPACE_FOLDER_CHANNEL, async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          properties: ["openDirectory", "createDirectory"],
          title: "Choose Workspace Folder",
          buttonLabel: "Use Folder",
        })
      : await dialog.showOpenDialog({
          properties: ["openDirectory", "createDirectory"],
          title: "Choose Workspace Folder",
          buttonLabel: "Use Folder",
        });

    return {
      canceled: result.canceled,
      path: result.canceled ? null : (result.filePaths[0] ?? null),
    };
  });

  ipcMain.handle(OPEN_PATH_IN_EDITOR_CHANNEL, async (_event, filePath: string) => {
    return openPathInEditor(filePath);
  });

  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      serverPort = await startServer();
      console.log(`Next.js server running on port ${serverPort}`);
      createWindow();
    } catch (err) {
      console.error("Failed to start server:", err);
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

app.on("before-quit", () => {
  stopServer();
});
