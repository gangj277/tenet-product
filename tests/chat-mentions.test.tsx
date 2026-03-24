import assert from "node:assert/strict";
import test from "node:test";

class MockNode {
  static TEXT_NODE = 3;

  nodeType: number;
  childNodes: MockNode[] = [];
  parentNode: MockElement | null = null;

  constructor(nodeType: number) {
    this.nodeType = nodeType;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(_value: string) {
    // noop in base
  }
}

class MockText extends MockNode {
  private value: string;

  constructor(value: string) {
    super(MockNode.TEXT_NODE);
    this.value = value;
  }

  override get textContent(): string {
    return this.value;
  }

  override set textContent(value: string) {
    this.value = value;
  }
}

class MockElement extends MockNode {
  dataset: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string) {
    super(1);
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: MockNode) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  override get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  override set textContent(value: string) {
    this.childNodes = [new MockText(value)];
  }

  querySelectorAll(selector: string): MockElement[] {
    const attrs = selector
      .split(",")
      .map((part) => part.trim().match(/^\[data-([a-z-]+)\]$/)?.[1])
      .filter((part): part is string => Boolean(part))
      .map((part) => part.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()));

    const matches: MockElement[] = [];

    function walk(node: MockNode) {
      if (node instanceof MockElement) {
        if (attrs.some((attr) => attr in node.dataset)) {
          matches.push(node);
        }
        node.childNodes.forEach(walk);
      }
    }

    this.childNodes.forEach(walk);
    return matches;
  }
}

function withMockDom<T>(fn: () => T): T {
  const originalNode = globalThis.Node;
  const originalElement = globalThis.HTMLElement;

  Object.assign(globalThis, {
    Node: MockNode,
    HTMLElement: MockElement,
  });

  try {
    return fn();
  } finally {
    if (originalNode) {
      Object.assign(globalThis, { Node: originalNode });
    } else {
      delete (globalThis as Record<string, unknown>).Node;
    }

    if (originalElement) {
      Object.assign(globalThis, { HTMLElement: originalElement });
    } else {
      delete (globalThis as Record<string, unknown>).HTMLElement;
    }
  }
}

test("composer serializer emits canonical file mention tokens", async () => {
  const serializer = await import(
    "../app/dashboard/[runId]/_components/chat/composer/composer-serializer.ts"
  );

  const text = withMockDom(() => {
    const editor = new MockElement("div");
    const chip = new MockElement("span");
    chip.dataset.fileKey = "source:paper-123";
    chip.dataset.fileLabel = "Paper title";
    chip.dataset.mentionToken = "@source:paper-123";
    editor.appendChild(chip);
    return serializer.serializeEditor(editor as unknown as HTMLDivElement);
  });

  assert.equal(text, "@source:paper-123");
});

test("folder mention chips serialize and count as editor content", async () => {
  const serializer = await import(
    "../app/dashboard/[runId]/_components/chat/composer/composer-serializer.ts"
  );

  const result = withMockDom(() => {
    const editor = new MockElement("div");
    const chip = new MockElement("span");
    chip.dataset.folderPath = "Research/Methods";
    chip.dataset.mentionToken = '@folder:"Research/Methods"';
    editor.appendChild(chip);

    return {
      text: serializer.serializeEditor(editor as unknown as HTMLDivElement),
      empty: serializer.checkEditorEmpty(editor as unknown as HTMLDivElement),
    };
  });

  assert.equal(result.text, '@folder:"Research/Methods"');
  assert.equal(result.empty, false);
});
