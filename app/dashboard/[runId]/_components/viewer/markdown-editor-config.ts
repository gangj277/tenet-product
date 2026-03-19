import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

export function buildMarkdownEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}
