"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "dear-creative-install-dismissed-at";
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function PwaInstall({ fullPage = false }: { fullPage?: boolean }) {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const isStandalone = () => displayMode.matches || Boolean(
      (navigator as Navigator & { standalone?: boolean }).standalone,
    );
    const updateInstalled = () => setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener("change", updateInstalled);

    const timer = window.setTimeout(() => {
      updateInstalled();
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      let recentlyDismissed = false;
      try {
        const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY));
        recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < REMIND_AFTER_MS;
      } catch { /* Installation remains available when storage is disabled. */ }
      setVisible(!recentlyDismissed);
    }, fullPage ? 0 : 5000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener("change", updateInstalled);
    };
  }, [fullPage]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => { /* The online site and installation instructions still work. */ });
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); }
    catch { /* Dismiss for this visit if storage is disabled. */ }
  }

  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    setError("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      else if (!fullPage) dismiss();
    } catch {
      setError("Use your browser menu to install, or try again on your next visit.");
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }

  const publicPage = pathname === "/" || pathname === "/posts" || pathname.startsWith("/posts/");
  if (!fullPage && (!visible || installed || (!prompt && !isIos) || !publicPage)) return null;

  if (fullPage && installed) {
    return <p role="status" className="rounded-2xl bg-emerald-50 p-5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">You’re using the Dear Creative app. You’re all set!</p>;
  }

  return (
    <section
      aria-label="Install Dear Creative"
      className={fullPage
        ? "rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        : "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/pwa/icon-192.png" alt="" width={48} height={48} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Keep Dear Creative close</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Add the app to your home screen. Free, straight from the web.</p>
        </div>
        {!fullPage && <button type="button" onClick={dismiss} aria-label="Dismiss install reminder" className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>}
      </div>
      {prompt ? (
        <button type="button" onClick={() => void install()} disabled={installing} className="mt-4 w-full rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
          {installing ? "Opening install…" : "Install Dear Creative"}
        </button>
      ) : isIos ? (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">Open this site in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> and <strong>Add</strong>. If shown, keep <strong>Open as Web App</strong> turned on.</p>
      ) : fullPage ? (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">In Chrome or Edge, open the browser menu and choose <strong>Install Dear Creative</strong> or <strong>Install app</strong> when available. On Mac, Safari offers <strong>File → Add to Dock</strong>. If you don’t see an install option, try opening this page in Chrome, Edge, or Safari.</p>
      ) : null}
      {error && <p role="status" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!fullPage && <Link href="/install" className="mt-3 inline-block text-sm text-emerald-700 underline underline-offset-2 dark:text-emerald-300">Installation help</Link>}
    </section>
  );
}
