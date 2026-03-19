import type { FileEntry } from "../../_lib/workspace-types";

export interface FolderNode {
  name: string;
  path: string;
  files: FileEntry[];
  children: FolderNode[];
}

export function buildFolderTree(
  files: FileEntry[],
  emptyFolders?: Set<string>
): { roots: FolderNode[]; ungrouped: FileEntry[] } {
  const ungrouped: FileEntry[] = [];
  const nodeMap = new Map<string, FolderNode>();

  function ensurePath(folderPath: string) {
    const segments = folderPath.split("/");
    let currentPath = "";

    for (const seg of segments) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;

      if (!nodeMap.has(currentPath)) {
        const node: FolderNode = {
          name: seg,
          path: currentPath,
          files: [],
          children: [],
        };

        nodeMap.set(currentPath, node);
        if (parentPath) {
          nodeMap.get(parentPath)?.children.push(node);
        }
      }
    }
  }

  if (emptyFolders) {
    for (const folderPath of emptyFolders) {
      ensurePath(folderPath);
    }
  }

  for (const file of files) {
    if (!file.folder) {
      ungrouped.push(file);
      continue;
    }

    ensurePath(file.folder);
    nodeMap.get(file.folder)?.files.push(file);
  }

  const roots: FolderNode[] = [];
  for (const [path, node] of nodeMap) {
    if (!path.includes("/")) {
      roots.push(node);
    }
  }

  return { roots, ungrouped };
}

export function countFilesInNode(node: FolderNode): number {
  return (
    node.files.length +
    node.children.reduce((sum, child) => sum + countFilesInNode(child), 0)
  );
}
