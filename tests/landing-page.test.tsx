import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

test("homepage presents Tenet as a thesis-development workspace", () => {
  const html = renderToStaticMarkup(<Home />);

  assert.match(html, /Tenet/i);
  assert.match(html, /Try demo/i);
  assert.match(html, /href="#demo"/i);
  assert.match(html, /href="#artifacts"/i);
  assert.match(html, /synthesis\.md/i);
  assert.match(html, /claims\.md/i);
  assert.match(html, /gaps\.md/i);
  assert.match(html, /next-steps\.md/i);
  assert.match(html, /evidence/i);
  assert.match(html, /inference/i);
  assert.match(html, /uncertainty/i);
});
