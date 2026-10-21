import type { AdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import { basescanAddressUrl } from "@/lib/admin/payout-address";

/** Server-safe payouts card markup for fixtures and screenshots (no client hooks). */
export function AdminPayoutsCardStatic({
  data,
}: {
  data: AdminPayoutsSnapshot;
}) {
  const rows = [
    { label: "Writer wallet (90%)", address: data.payoutWalletAddress },
    { label: "PullSplit contract", address: data.payoutSplitAddress },
    { label: "Treasury (10%)", address: data.treasuryAddress },
  ] as const;

  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60"
      data-testid="admin-payouts-card"
    >
      <h3 className="text-sm font-semibold">Payouts</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Subscriptions and tips pay into this Split: 90% writer, 10% treasury.
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {row.label}
            </p>
            {row.address ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-mono dark:bg-zinc-950">
                  {row.address}
                </code>
                <a
                  href={basescanAddressUrl(row.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
                >
                  BaseScan
                </a>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Not set</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
