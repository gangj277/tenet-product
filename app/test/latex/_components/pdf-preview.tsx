"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfPreview({ pdfUrl }: { pdfUrl: string | null }) {
  const [numPages, setNumPages] = useState<number>(0);

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full text-dim text-sm">
        Click <span className="font-semibold text-body mx-1">Compile</span> to preview
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#525659] p-4 flex flex-col items-center gap-4">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={600}
            className="shadow-lg mb-4"
          />
        ))}
      </Document>
    </div>
  );
}
