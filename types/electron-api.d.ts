export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      chooseWorkspaceFolder: () => Promise<{
        canceled: boolean;
        path: string | null;
      }>;
      openPathInEditor: (filePath: string) => Promise<{
        ok: boolean;
        mode?: "cursor" | "vscode" | "default" | "revealed";
        error?: string;
      }>;
    };
  }
}
