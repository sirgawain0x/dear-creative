import type { Metadata } from "next";
import { PwaInstall } from "@/components/pwa-install";

export const metadata: Metadata = {
  title: "Install Dear Creative",
  description: "Install Dear Creative directly from the web on your phone or computer.",
};

export default function InstallPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-brand text-2xl font-semibold sm:text-3xl">Dear Creative, on your home screen.</h1>
      <p className="mt-4 mb-8 text-zinc-600 dark:text-zinc-300">Get to the latest dispatches with a tap. Install directly from your browser, with no App Store download.</p>
      <PwaInstall fullPage />
      <div className="mt-8 space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
        <p><strong>iPhone and iPad:</strong> Open Dear Creative in Safari. Tap Share → Add to Home Screen → Add. If shown, leave Open as Web App enabled.</p>
        <p><strong>Android and desktop:</strong> Use the install button above when available, or your browser’s install menu. On Mac, use Safari’s File → Add to Dock.</p>
        <p>The app stays up to date when you’re online. Articles, account access, and wallet features need an internet connection.</p>
      </div>
    </main>
  );
}
