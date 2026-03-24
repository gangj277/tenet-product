import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("skill picker includes the /compact command in slash suggestions", async () => {
  const pickerModule = await import(
    "../app/dashboard/[runId]/_components/chat/skill-picker.tsx"
  );

  const SkillPicker =
    pickerModule.SkillPicker ?? pickerModule.default.SkillPicker;

  const Picker = SkillPicker as unknown as (props: {
    query: string;
    onSelect: (slash: string) => void;
    onClose: () => void;
  }) => JSX.Element;

  const html = renderToStaticMarkup(
    <Picker query="comp" onSelect={() => {}} onClose={() => {}} />
  );

  assert.match(html, /\/compact/i);
  assert.match(html, /Compact Context/i);
});
