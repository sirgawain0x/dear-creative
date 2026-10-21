"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/components/providers/app-providers";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import {
  computeEarnedYieldRaw,
  formatApyBps,
  formatTokenAmountFromRaw,
  formatUsdWhole,
  isBaseUsdcVault,
} from "@/lib/earn/format";
import type { PrivyEarnVaultDetails } from "@/lib/earn/privy-earn";
import {
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
} from "@/lib/earn/vaults";

type PositionPayload =
  | {
      configured: false;
      reason: "unset" | "invalid";
      vaultId: string;
    }
  | {
      configured: true;
      vaultId: string;
      position: {
        asset: { symbol: string; decimals: number };
        total_deposited: string;
        total_withdrawn: string;
        assets_in_vault: string;
      };
    };

export type AdminEarnPreviewData = {
  vaults: PrivyEarnVaultDetails[];
  positions: Record<string, PositionPayload>;
};

type AdminEarnPanelProps = {
  earnEnabled: boolean;
  previewData?: AdminEarnPreviewData;
};

const DEFAULT_VAULT_ORDER = [EARN_VAULT_AAVE_ID, EARN_VAULT_MORPHO_ID];

function providerLabel(provider: PrivyEarnVaultDetails["provider"]): string {
  switch (provider) {
    case "aave":
      return "Aave";
    case "morpho":
      return "Morpho";
    case "veda":
      return "Veda";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function AdminEarnPanel({
  earnEnabled,
  previewData,
}: AdminEarnPanelProps) {
  const {
    ready,
    isSignedIn,
    authenticated,
    getAccessToken,
    privyConfigured,
  } = useAuthSession();
  const [loading, setLoading] = useState(
    () => earnEnabled && !previewData,
  );
  const [error, setError] = useState<string | null>(null);
  const [vaults, setVaults] = useState<PrivyEarnVaultDetails[]>(
    previewData?.vaults ?? [],
  );
  const [positions, setPositions] = useState<
    Record<string, PositionPayload>
  >(previewData?.positions ?? {});
  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    DEFAULT_VAULT_ORDER[0],
  );

  const selectedVault = useMemo(
    () => vaults.find((v) => v.id === selectedVaultId) ?? vaults[0] ?? null,
    [vaults, selectedVaultId],
  );

  const selectedPosition = selectedVault
    ? positions[selectedVault.id]
    : undefined;

  const positionDisplay = useMemo(() => {
    if (!selectedPosition || !selectedPosition.configured) {
      return null;
    }
    const { position, asset } = {
      position: selectedPosition.position,
      asset: selectedPosition.position.asset,
    };
    const decimals = asset.decimals;
    const assetsRaw = BigInt(position.assets_in_vault);
    const depositedRaw = BigInt(position.total_deposited);
    const withdrawnRaw = BigInt(position.total_withdrawn);
    const yieldRaw = computeEarnedYieldRaw(
      assetsRaw,
      depositedRaw,
      withdrawnRaw,
    );
    return {
      balance: formatTokenAmountFromRaw(position.assets_in_vault, decimals),
      yieldEarned: formatTokenAmountFromRaw(yieldRaw.toString(), decimals),
      symbol: asset.symbol.toUpperCase(),
    };
  }, [selectedPosition]);

  const fetchEarnData = useCallback(async () => {
    if (!earnEnabled || previewData) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const headers = await adminPrivyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!ready || !isSignedIn || !headers) {
        setError("Sign in to view Earn vault data.");
        return;
      }

      const vaultsRes = await fetch("/api/admin/earn/vaults", { headers });
      if (vaultsRes.status === 404) {
        setError("Earn feature is disabled.");
        return;
      }
      if (vaultsRes.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!vaultsRes.ok) {
        setError("Could not load vault details.");
        return;
      }
      const vaultsJson = (await vaultsRes.json()) as {
        vaults: PrivyEarnVaultDetails[];
      };
      setVaults(vaultsJson.vaults);
      if (vaultsJson.vaults.length > 0) {
        setSelectedVaultId((current) =>
          vaultsJson.vaults.some((v) => v.id === current)
            ? current
            : vaultsJson.vaults[0].id,
        );
      }

      const positionEntries = await Promise.all(
        vaultsJson.vaults.map(async (vault) => {
          const res = await fetch(
            `/api/admin/earn/position?vault=${encodeURIComponent(vault.id)}`,
            { headers },
          );
          if (!res.ok) {
            return [vault.id, null] as const;
          }
          const json = (await res.json()) as PositionPayload;
          return [vault.id, json] as const;
        }),
      );
      const nextPositions: Record<string, PositionPayload> = {};
      for (const [id, payload] of positionEntries) {
        if (payload) {
          nextPositions[id] = payload;
        }
      }
      setPositions(nextPositions);
    } catch {
      setError("Failed to load Earn data.");
    } finally {
      setLoading(false);
    }
  }, [
    earnEnabled,
    previewData,
    privyConfigured,
    authenticated,
    getAccessToken,
    ready,
    isSignedIn,
  ]);

  useEffect(() => {
    if (!earnEnabled || previewData) {
      return;
    }
    void fetchEarnData();
  }, [earnEnabled, previewData, fetchEarnData]);

  if (!earnEnabled) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Privy Earn (read-only) is disabled. Set{" "}
        <code className="text-xs">EARN_ENABLED=true</code> to enable.
      </div>
    );
  }

  const showChainWarning =
    selectedVault &&
    !isBaseUsdcVault({
      symbol: selectedVault.asset.symbol,
      caip2: selectedVault.caip2,
    });

  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60"
      data-testid="admin-earn-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Earn (read-only)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Vault metrics and admin wallet position via Privy Earn. No deposits
            or withdrawals in this release.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchEarnData()}
          disabled={loading || Boolean(previewData)}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {loading && vaults.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Loading Earn vaults…</p>
      ) : null}

      {vaults.length > 0 ? (
        <div className="mt-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Vault
            <select
              className="mt-1 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950"
              value={selectedVault?.id ?? ""}
              onChange={(event) => setSelectedVaultId(event.target.value)}
            >
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.name} ({providerLabel(vault.provider)})
                </option>
              ))}
            </select>
          </label>

          {showChainWarning ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              This vault is not Base USDC (
              <code className="font-mono">{selectedVault?.caip2}</code>,{" "}
              {selectedVault?.asset.symbol.toUpperCase()}). Confirm before
              relying on these metrics.
            </div>
          ) : null}

          {selectedVault ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="APY"
                value={formatApyBps(selectedVault.user_apy)}
              />
              <MetricCard
                label="TVL"
                value={formatUsdWhole(selectedVault.tvl_usd)}
              />
              <MetricCard
                label="Liquidity"
                value={formatUsdWhole(selectedVault.available_liquidity_usd)}
              />
              <MetricCard
                label="Provider"
                value={providerLabel(selectedVault.provider)}
              />
            </div>
          ) : null}

          {selectedVault ? (
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Vault contract (Base)
              </p>
              <a
                className="mt-2 block break-all text-xs font-mono text-emerald-700 underline dark:text-emerald-400"
                href={`https://basescan.org/address/${selectedVault.vault_address}`}
                target="_blank"
                rel="noreferrer"
              >
                {selectedVault.vault_address}
              </a>
            </div>
          ) : null}

          {selectedPosition && !selectedPosition.configured ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Admin wallet not configured</p>
              <p className="mt-1 text-xs opacity-90">
                Set <code>ADMIN_PRIVY_WALLET_ID</code> to the Privy wallet id
                used for Earn position reads.
              </p>
            </div>
          ) : null}

          {positionDisplay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Position"
                value={`${positionDisplay.balance} ${positionDisplay.symbol}`}
              />
              <MetricCard
                label="Yield earned"
                value={`${positionDisplay.yieldEarned} ${positionDisplay.symbol}`}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums break-words">{value}</p>
    </div>
  );
}
