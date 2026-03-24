import assert from "node:assert/strict";
import test from "node:test";

test("agent infrastructure lists folders and explains folder mentions", async () => {
  const constitution = await import("../lib/agent/prompts/constitution.ts");

  const prompt = constitution.buildInfrastructure({
    workspaceFiles: { "note:1": "# Method notes" },
    availableKeys: ["note:1"],
    fileLabels: { "note:1": "Method notes" },
    fileMeta: {
      "note:1": {
        group: "note",
        folder: "Research/Methods",
      },
    },
    folderPaths: ["Research", "Research/Methods", "Research/Empty"],
  } as never);

  assert.match(prompt, /### Folders \(3\)/);
  assert.match(prompt, /Research\/Methods/);
  assert.match(prompt, /Research\/Empty/);
  assert.match(prompt, /@folder:/);
});

test("write_new_file preserves folder placement for new notes", async () => {
  const { executeWriteNewFile } = await import("../lib/agent/tools/write-new-file.ts");

  const result = executeWriteNewFile(
    {
      key: "note:folder-note",
      label: "Folder note",
      content: "# Draft",
      folder: "Research/Methods",
    } as never,
    {
      workspaceFiles: {},
      availableKeys: [],
      folderPaths: ["Research/Methods"],
    } as never
  );

  assert.equal((result.update as { folder?: string } | null)?.folder, "Research/Methods");
});

test("write_new_file rewrites note slug keys to uuid-backed note ids", async () => {
  const { executeWriteNewFile } = await import("../lib/agent/tools/write-new-file.ts");

  const result = executeWriteNewFile(
    {
      key: "note:mvp-architecture-brief",
      label: "MVP architecture brief",
      content: "# Draft",
    },
    {
      workspaceFiles: {},
      availableKeys: [],
    } as never
  );

  assert.ok(result.update, "expected a proposed update");
  assert.notEqual(result.update?.key, "note:mvp-architecture-brief");
  assert.match(
    result.update!.key,
    /^note:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
});
