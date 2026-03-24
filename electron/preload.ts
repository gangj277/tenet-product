import { contextBridge, ipcRenderer } from "electron";

const CHOOSE_WORKSPACE_FOLDER_CHANNEL = "workspace:choose-folder";
const OPEN_PATH_IN_EDITOR_CHANNEL = "workspace:open-path-in-editor";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  chooseWorkspaceFolder: () =>
    ipcRenderer.invoke(CHOOSE_WORKSPACE_FOLDER_CHANNEL) as Promise<{
      canceled: boolean;
      path: string | null;
    }>,
  openPathInEditor: (filePath: string) =>
    ipcRenderer.invoke(OPEN_PATH_IN_EDITOR_CHANNEL, filePath) as Promise<{
      ok: boolean;
      mode?: "cursor" | "vscode" | "default" | "revealed";
      error?: string;
    }>,
});
