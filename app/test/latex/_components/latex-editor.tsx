"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-panel/50">
      <div className="h-5 w-5 rounded-full border-2 border-accent-fill border-t-transparent animate-spin" />
    </div>
  ),
});

export function LatexEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <MonacoEditor
      language="latex"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        wordWrap: "on",
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        padding: { top: 12 },
      }}
    />
  );
}
