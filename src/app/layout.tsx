import { JetBrains_Mono, Inter } from "next/font/google";
import Script from "next/script";

import { AppProviders } from "@/components/providers/AppProviders";
import { appConfig } from "@/lib/config/env";
import { METAMASK_NOISE_BOOTSTRAP_SCRIPT } from "@/lib/web3auth/ethereumGuard";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: {
    default: appConfig.appName,
    template: `%s | ${appConfig.appName}`,
  },
  description:
    "Automated yield and transparent governance on the XRP Ledger via native on-chain escrows.",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Root App Router layout — providers + ambient background only.
 * Marketing and authenticated shells live in route-group layouts.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Script
          id="suppress-metamask-noise"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: METAMASK_NOISE_BOOTSTRAP_SCRIPT,
          }}
        />
        <AppProviders>
          <div className="relative flex min-h-screen flex-col overflow-x-hidden">
            <div
              className="pointer-events-none fixed inset-0 bg-grid-vault bg-[size:64px_64px] opacity-40"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none fixed inset-0 bg-gradient-radial-vault"
              aria-hidden="true"
            />
            <div className="relative flex min-h-screen flex-1 flex-col">
              {children}
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
