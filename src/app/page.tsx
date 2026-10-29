import { Suspense } from "react";
import { ActiveSubscriberLine } from "@/components/home/active-subscriber-line";
import { HomeAboutSection } from "@/components/home/home-about-section";
import { HomeHeroSubscribeCta } from "@/components/home/home-hero-subscribe-cta";
import { HomeSpotlight } from "@/components/home/home-spotlight";
import { HomeSubscribeHashScroll } from "@/components/home/home-subscribe-hash-scroll";
import { HomeSubscribeCta } from "@/components/home/home-subscribe-cta";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16 md:max-w-6xl">
      <HomeSubscribeHashScroll />
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <img
            src="/images/dear-creative-logo.png"
            alt="Dear Creative Mascot Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Creative Platform Dispatches
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dear Creative
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
            The publication for autonomous creators, onchain builders, and independent founders.
          </p>
          <Suspense fallback={null}>
            <ActiveSubscriberLine />
          </Suspense>
        </div>
      </div>

      <HomeHeroSubscribeCta />

      <Suspense
        fallback={
          <p className="text-sm text-zinc-500" aria-busy="true">
            Loading latest dispatches…
          </p>
        }
      >
        <HomeSpotlight />
      </Suspense>

      <HomeSubscribeCta />

      <Suspense
        fallback={
          <p className="text-sm text-zinc-500" aria-busy="true">
            Loading about…
          </p>
        }
      >
        <HomeAboutSection />
      </Suspense>
    </main>
  );
}
