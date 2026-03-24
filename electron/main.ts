import {
  app,
  BrowserWindow,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { loadAppEnv } from "./load-env";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number = 3000;

const isDev = !app.isPackaged;

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

function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: "pipe",
    });

    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      console.log(`[startup] ${data.toString().trim()}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      console.error(`[startup] ${text.trim()}`);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

async function ensureDevDatabaseSchema() {
  if (!isDev) {
    return;
  }

  const drizzleBin = path.join(process.cwd(), "node_modules", ".bin", "drizzle-kit");
  if (!fs.existsSync(drizzleBin)) {
    throw new Error("drizzle-kit is not installed in this workspace.");
  }

  await runCommand(drizzleBin, ["push", "--force"], {
    cwd: process.cwd(),
    env: {
      ...loadAppEnv(process.cwd()),
      ...process.env,
    },
  });
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
  await ensureDevDatabaseSchema();

  const port = await findFreePort();
  const envConfig = loadEnvConfig();

  const env: Record<string, string> = {
    ...loadAppEnv(process.cwd()),
    ...process.env as Record<string, string>,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    ELECTRON: "1",
    ...envConfig,
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
    // Production: run the standalone server
    const serverPath = path.join(process.resourcesPath, "standalone", "server.js");
    serverProcess = spawn(process.execPath.replace(/electron/i, "node"), [serverPath], {
      env: {
        ...env,
        // Tell Next.js standalone where static files live
        NEXT_STATIC_DIR: path.join(process.resourcesPath, "static"),
      },
      cwd: path.join(process.resourcesPath, "standalone"),
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
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

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

app.on("before-quit", () => {
  stopServer();
});
