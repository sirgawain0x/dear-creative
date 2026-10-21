"use client";

import { useCallback, useEffect, useState } from "react";
import { privyAuthorizationHeaders } from "@/lib/privy/privy-authorization-headers";
import { useAuthSession } from "@/components/providers/app-providers";

export function useReaderWalletAddress(enabled: boolean): {
  address: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const { authenticated, getAccessToken, privyConfigured, ready } = useAuthSession();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAddress = useCallback(async () => {
    if (!enabled || !authenticated) {
      setAddress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = await privyAuthorizationHeaders({
        privyConfigured,
        authenticated,
        getAccessToken,
      });
      if (!headers) {
        setAddress(null);
        return;
      }
      const res = await fetch("/api/wallet/me", { headers });
      if (!res.ok) {
        setAddress(null);
        return;
      }
      const body = (await res.json()) as { configured?: boolean; address?: string };
      setAddress(body.configured && body.address ? body.address : null);
    } catch {
      setAddress(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, enabled, getAccessToken, privyConfigured]);

  useEffect(() => {
    if (!ready || !enabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const headers = await privyAuthorizationHeaders({
          privyConfigured,
          authenticated,
          getAccessToken,
        });
        if (!headers || cancelled) {
          if (!cancelled) {
            setAddress(null);
          }
          return;
        }
        const res = await fetch("/api/wallet/me", { headers });
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setAddress(null);
          return;
        }
        const body = (await res.json()) as { configured?: boolean; address?: string };
        setAddress(body.configured && body.address ? body.address : null);
      } catch {
        if (!cancelled) {
          setAddress(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, enabled, authenticated, getAccessToken, privyConfigured]);

  return { address, loading, refresh: fetchAddress };
}
