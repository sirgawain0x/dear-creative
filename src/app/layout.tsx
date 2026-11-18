import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { BotIdProtect } from "@/components/botid-protect";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { PwaInstall } from "@/components/pwa-install";
import { getPrivyAppId } from "@/lib/privy/config";
import { isReaderWalletEnabled } from "@/lib/wallet/reader-wallet-feature-flag";
import { isReaderWalletE2eAuthEnabled } from "@/lib/wallet/reader-wallet-e2e-auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const conthrax = localFont({
  src: "./fonts/conthrax-sb.ttf",
  variable: "--font-conthrax",
  weight: "600",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dear Creative",
  description: "The publication for autonomous creators, onchain builders, and independent founders.",
  appleWebApp: { capable: true, title: "Dear Creative", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const privyAppId = getPrivyAppId();
  const readerWalletEnabled = isReaderWalletEnabled();
  const readerWalletE2eAuthEnabled = isReaderWalletE2eAuthEnabled();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${conthrax.variable} h-full antialiased`}
    >
      <head>
        <BotIdProtect />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <AppProviders
          privyAppId={privyAppId}
          readerWalletE2eAuthEnabled={readerWalletE2eAuthEnabled}
        >
          <SiteHeaderShell readerWalletEnabled={readerWalletEnabled} />
          <div className="min-w-0 flex-1">{children}</div>
        </AppProviders>
        <SiteFooter />
        <Suspense fallback={null}>
          <PwaInstall />
        </Suspense>
      </body>
    </html>
  );
}
