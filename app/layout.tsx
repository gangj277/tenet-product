import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Manrope({
  variable: "--font-tenet-sans",
  subsets: ["latin"],
});

const serif = Newsreader({
  variable: "--font-tenet-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tenet — AI-Native Research Workspace",
  description:
    "Turn rough questions into structured synthesis with tracked claims, visible contradictions, evidence maps, and an AI partner grounded in your sources.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
