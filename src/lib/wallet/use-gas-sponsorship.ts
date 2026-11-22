"use client";

import { useEffect, useState } from "react";
import { useSafePrivy } from "@/components/providers/app-providers";

export type ClientGasSponsorship = {
  mode: "sponsored" | "self_paid";
  reason: string;
  wallet: string | null;
  erc20?: {
    policyId: string | null;
    chainId: number;
    tokenAddress: string;
    tokenSymbol: string;
  };
};

const CACHE_TTL_MS = 60_000;

const SELF_PAID: ClientGasSponsorship = {
  mode: "self_paid",
  reason: "signed_out",
  wallet: null,
};

type CacheEntry = {
  userId: string;
  value: ClientGasSponsorship;
  expiresAtMs: number;
};

let cache: CacheEntry | null = null;
let inflight: { userId: string; promise: Promise<ClientGasSponsorship> } | null =
  null;

export function resetGasSponsorshipCacheForTests(): void {
  cache = null;
  inflight = null;
}

export async function fetchGasSponsorship(
  options: { userId?: string | null; force?: boolean } = {},
): Promise<ClientGasSponsorship> {
  const userId = options.userId ?? "";

  if (!options.force && cache?.userId === userId && cache.expiresAtMs > Date.now()) {
    return cache.value;
  }
  if (!options.force && inflight?.userId === userId) {
    return inflight.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetch("/api/wallet/gas-sponsorship", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        return SELF_PAID;
      }
      const json = (await res.json()) as ClientGasSponsorship;
      const value: ClientGasSponsorship =
        json.mode === "sponsored" ? json : { ...json, mode: "self_paid" };
      cache = { userId, value, expiresAtMs: Date.now() + CACHE_TTL_MS };
      return value;
    } catch {
      return SELF_PAID;
    } finally {
      if (inflight?.userId === userId) {
        inflight = null;
      }
    }
  })();

  inflight = { userId, promise };
  return promise;
}

/**
 * Whether this signed-in viewer's gas is sponsored (active Creator Pass).
 * Fails closed to self-paid, and never reuses another user's cached decision.
 */
export function useGasSponsorship(): {
  decision: ClientGasSponsorship;
  sponsored: boolean;
  loading: boolean;
} {
  const { ready, authenticated, user } = useSafePrivy();
  const userId = user?.id ?? null;
  const active = ready && authenticated && Boolean(userId);

  const [remote, setRemote] = useState<{
    userId: string;
    value: ClientGasSponsorship;
  } | null>(null);

  useEffect(() => {
    if (!active || !userId) {
      return;
    }
    let cancelled = false;
    void fetchGasSponsorship({ userId }).then((next) => {
      if (!cancelled) {
        setRemote({ userId, value: next });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, userId]);

  const decision =
    active && remote?.userId === userId ? remote.value : SELF_PAID;

  return {
    decision,
    sponsored: decision.mode === "sponsored",
    loading: active && remote?.userId !== userId,
  };
}
