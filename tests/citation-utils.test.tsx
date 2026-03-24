import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSourceLookup,
  linkifyCitations,
} from "../app/dashboard/_lib/citation-utils";

test("linkifyCitations resolves note file citations into internal source links", () => {
  const lookup = buildSourceLookup([
    {
      key: "note:44e54c8e-3143-4393-8151-68b515637794",
      label: "Port thesis",
      group: "note",
    },
    {
      key: "source:abc12345-def6-7890-abcd-ef1234567890",
      label: "Background paper",
      group: "source",
    },
  ]);

  const markdown =
    "This is grounded in [Source: note:44e54c8e-3143-4393-8151-68b515637794, Bottom Line].";

  assert.equal(
    linkifyCitations(markdown, lookup),
    "This is grounded in [§ Bottom Line](#source:note:44e54c8e-3143-4393-8151-68b515637794)."
  );
});
