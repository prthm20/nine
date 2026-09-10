import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: {
    default: "Company Risk Dossier",
    template: "%s · Company Risk Dossier",
  },
  description:
    "OSINT-powered company risk dossiers with explainable scoring, cited evidence and continuous monitoring.",
  applicationName: "Company Risk Dossier",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>
          <footer className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
            <p className="border-t border-hairline pt-5 text-xs leading-relaxed text-muted">
              Signals are collected from public OSINT sources (news, court records, regulatory
              filings, DNS and certificate transparency) and matched by company name. Findings are
              potential matches requiring analyst review — not verified adverse findings, and not
              legal, financial or investment advice.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
