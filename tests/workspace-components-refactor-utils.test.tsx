import assert from "node:assert/strict";
import test from "node:test";
import type { LineRange } from "../app/dashboard/_lib/citation-utils.ts";
import type { FileEntry } from "../app/dashboard/[runId]/_lib/workspace-types.ts";
import type { ExperimentDesign } from "../lib/agent/tools/experiment-design-schema.ts";

function makeExperimentDesign(): ExperimentDesign {
  return {
    version: 1,
    title: "Caffeine and Recall",
    researchQuestion: "Does caffeine improve short-term recall?",
    motivation: "Prior results are mixed.",
    hypotheses: [
      {
        id: "H1",
        type: "alternative",
        statement: "Caffeine improves recall scores.",
      },
    ],
    variables: {
      independent: [
        {
          name: "Dose",
          description: "Caffeine dose",
          levels: ["0mg", "100mg"],
        },
      ],
      dependent: [
        {
          name: "Recall score",
          measure: "Correct answers",
        },
      ],
      controls: [
        {
          name: "Sleep",
          rationale: "Sleep affects recall",
        },
      ],
    },
    design: {
      type: "Between-subjects",
      justification: "Reduces carryover effects",
    },
    sample: {
      population: "Adults",
      targetN: 120,
      powerRationale: "Powered for medium effects",
      recruitment: "Campus participant pool",
    },
    procedure: ["Consent", "Dose", "Recall task"],
    analysis: {
      primaryTest: "t-test",
      alpha: ".05",
      effectSizeMeasure: "Cohen's d",
      missingDataStrategy: "Listwise deletion",
      secondaryAnalyses: ["Exploratory subgroup analysis"],
    },
    limitations: ["Self-selection bias"],
    ethics: "Low risk with informed consent.",
  };
}

test("sidebar tree utils build nested roots and count descendant files", async () => {
  const treeUtils = await import(
    "../app/dashboard/[runId]/_components/sidebar/tree-utils.ts"
  );

  const files: FileEntry[] = [
    {
      key: "note:1",
      label: "Root note",
      shortLabel: "Root note",
      icon: "note",
      group: "note",
    },
    {
      key: "note:2",
      label: "Methods",
      shortLabel: "Methods",
      icon: "note",
      group: "note",
      folder: "Research/Methods",
    },
    {
      key: "note:3",
      label: "Results",
      shortLabel: "Results",
      icon: "note",
      group: "note",
      folder: "Research/Results",
    },
  ];

  const { roots, ungrouped } = treeUtils.buildFolderTree(
    files,
    new Set(["Research/Empty"])
  );

  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].key, "note:1");
  assert.equal(roots.length, 1);
  assert.equal(roots[0].name, "Research");
  assert.equal(roots[0].children.length, 3);
  assert.equal(treeUtils.countFilesInNode(roots[0]), 2);
});

test("chat message utils format citation counts and parse experiment diffs", async () => {
  const messageUtils = await import(
    "../app/dashboard/[runId]/_components/chat/message/message-utils.ts"
  );

  const oldDesign = makeExperimentDesign();
  const newDesign = {
    ...oldDesign,
    title: "Caffeine and Working Memory",
  };

  assert.equal(messageUtils.formatCitations(9), "9");
  assert.equal(messageUtils.formatCitations(1200), "1.2k");

  const parsed = messageUtils.parseExperimentDiff(
    JSON.stringify(oldDesign),
    JSON.stringify(newDesign)
  );

  assert.ok(parsed);
  assert.equal(parsed.oldDesign.title, oldDesign.title);
  assert.equal(parsed.newDesign.title, newDesign.title);
  assert.equal(
    messageUtils.parseExperimentDiff("not-json", JSON.stringify(newDesign)),
    null
  );
});

test("scroll helpers derive a plain-text needle from a markdown line range", async () => {
  const scrollUtils = await import(
    "../app/dashboard/[runId]/_components/viewer/scroll-to-line-range.ts"
  );

  const content = [
    "",
    "## Findings",
    "**Strong** evidence for benefit",
    "",
    "- point a",
  ].join("\n");
  const range: LineRange = { start: 2, end: 3 };

  assert.equal(
    scrollUtils.getPlainTextNeedleForLineRange(content, range),
    "Findings"
  );
  assert.equal(
    scrollUtils.stripMarkdownForTextMatch("**Bold** `code` [link](https://x.com)"),
    "Bold code link"
  );
  assert.equal(
    scrollUtils.getPlainTextNeedleForLineRange("\n\n", { start: 1, end: 2 }),
    null
  );
});

test("experiment utils parse valid content and deep-clone editable drafts", async () => {
  const experimentUtils = await import(
    "../app/dashboard/[runId]/_components/viewer/experiment/experiment-utils.ts"
  );

  const design = makeExperimentDesign();
  const parsed = experimentUtils.parseExperimentDesignContent(
    JSON.stringify(design)
  );

  assert.ok(parsed);
  assert.equal(parsed.title, design.title);
  assert.equal(experimentUtils.parseExperimentDesignContent("bad-json"), null);

  const clone = experimentUtils.cloneExperimentDesign(design);
  clone.hypotheses[0].statement = "Changed";

  assert.equal(design.hypotheses[0].statement, "Caffeine improves recall scores.");
  assert.equal(clone.hypotheses[0].statement, "Changed");
});
