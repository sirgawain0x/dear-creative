import Link from "next/link";
import { SubscribeForm } from "@/components/subscribe-form";
import { isPaywallEnabled } from "@/lib/paywall/feature-flag";

export const HOME_SUBSCRIBE_SECTION_ID = "subscribe";

export function HomeSubscribeCta() {
  const showPaidUnlock = isPaywallEnabled();

  return (
    <section
      id={HOME_SUBSCRIBE_SECTION_ID}
      aria-labelledby="home-subscribe-heading"
      className="rounded-2xl border border-zinc-200/90 bg-white p-6 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 md:p-8"
    >
      <h2
        id="home-subscribe-heading"
        className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        Get Dear Creative in your inbox
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Free newsletter with double opt-in — we send a confirmation email before
        you&apos;re added to the list.
      </p>

      <div className="mt-6 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full min-w-0 flex-1 flex-col items-center lg:max-w-md">
          <SubscribeForm centered />
        </div>

        {showPaidUnlock ? (
          <div className="w-full max-w-md rounded-xl border border-amber-200/80 bg-amber-50/70 p-5 text-left dark:border-amber-900/40 dark:bg-amber-950/25">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              Paid dispatches
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              Some dispatches are subscriber-only. Choose a gated post in the
              archive to unlock it with a one-time USDC payment on Base.
            </p>
            <Link
              href="/posts"
              className="mt-4 inline-flex text-sm font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
            >
              Browse dispatches →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
