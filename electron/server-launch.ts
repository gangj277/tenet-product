import path from "path";

export type ServerLaunchConfig = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export function getProductionServerLaunchConfig(input: {
  env: NodeJS.ProcessEnv;
  execPath: string;
  resourcesPath: string;
}): ServerLaunchConfig {
  const serverPath = path.join(input.resourcesPath, "standalone", "server.js");

  return {
    command: input.execPath,
    args: [serverPath],
    cwd: path.join(input.resourcesPath, "standalone"),
    env: {
      ...input.env,
      ELECTRON_RUN_AS_NODE: "1",
      NEXT_STATIC_DIR: path.join(input.resourcesPath, "static"),
    },
  };
}

export function getLocalProductionServerLaunchConfig(input: {
  env: NodeJS.ProcessEnv;
  execPath: string;
  projectDir: string;
}): ServerLaunchConfig {
  const standaloneDir = path.join(input.projectDir, ".next", "standalone");
  const serverPath = path.join(standaloneDir, "server.js");

  return {
    command: input.execPath,
    args: [serverPath],
    cwd: standaloneDir,
    env: {
      ...input.env,
      ELECTRON_RUN_AS_NODE: "1",
      NEXT_STATIC_DIR: path.join(input.projectDir, ".next", "static"),
    },
  };
}
