import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  canStartBlankWorkspace,
  canStartResearch,
  requireSelectedWorkspacePath,
} from "../app/dashboard/new/_lib/workspace-folder";
import { WorkspaceFolderField } from "../app/dashboard/new/_components/workspace-folder-field";

test("requireSelectedWorkspacePath throws in Electron mode when no folder is selected", () => {
  assert.throws(
    () =>
      requireSelectedWorkspacePath({
        isElectron: true,
        workspacePath: null,
      }),
    /Choose a workspace folder before starting\./i
  );
});

test("requireSelectedWorkspacePath returns the chosen folder in Electron mode", () => {
  assert.equal(
    requireSelectedWorkspacePath({
      isElectron: true,
      workspacePath: "/Users/tester/Research Workspace",
    }),
    "/Users/tester/Research Workspace"
  );
});

test("canStartResearch requires a selected folder in Electron mode", () => {
  assert.equal(
    canStartResearch({
      question: "What causes model collapse?",
      isElectron: true,
      workspacePath: null,
      phase: "form",
      creatingBlankWorkspace: false,
    }),
    false
  );

  assert.equal(
    canStartResearch({
      question: "What causes model collapse?",
      isElectron: true,
      workspacePath: "/Users/tester/Research Workspace",
      phase: "form",
      creatingBlankWorkspace: false,
    }),
    true
  );
});

test("canStartBlankWorkspace requires a selected folder in Electron mode", () => {
  assert.equal(
    canStartBlankWorkspace({
      isElectron: true,
      workspacePath: null,
      phase: "form",
      creatingBlankWorkspace: false,
    }),
    false
  );

  assert.equal(
    canStartBlankWorkspace({
      isElectron: true,
      workspacePath: "/Users/tester/Research Workspace",
      phase: "form",
      creatingBlankWorkspace: false,
    }),
    true
  );
});

test("workspace folder field prompts for a folder before project creation", () => {
  const html = renderToStaticMarkup(
    <WorkspaceFolderField
      workspacePath={null}
      disabled={false}
      onChoose={() => {}}
    />
  );

  assert.match(html, /Workspace folder/i);
  assert.match(html, /Choose where this local workspace should be created\./i);
  assert.match(html, />Choose folder</i);
  assert.match(html, /Required before you can start research or create a blank workspace\./i);
});

test("workspace folder field shows the selected folder and lets the user change it", () => {
  const html = renderToStaticMarkup(
    <WorkspaceFolderField
      workspacePath="/Users/tester/Research Workspace"
      disabled={false}
      onChoose={() => {}}
    />
  );

  assert.match(html, /Selected folder/i);
  assert.match(html, /Research Workspace/i);
  assert.match(html, />Change folder</i);
});
