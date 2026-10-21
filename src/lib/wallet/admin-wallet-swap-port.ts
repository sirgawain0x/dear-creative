import type { SwapDirection } from "./swap-constants";
import type { WalletSwapPort, WalletSwapQuoteSummary } from "@/components/wallet/wallet-swap-types";

export type CreateAdminWalletSwapPortOptions = {
  getRequestHeaders: () => Promise<Record<string, string> | null>;
  previewMode?: boolean;
};

export function createAdminWalletSwapPort(
  options: CreateAdminWalletSwapPortOptions,
): WalletSwapPort {
  return {
    async requestQuote(input) {
      if (options.previewMode) {
        const mock: WalletSwapQuoteSummary = {
          from: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
          direction: input.direction,
          amount: input.amount,
          slippageBps: input.slippageBps ?? 50,
          chainId: 8453,
          needsWalletUpgrade: true,
          quote: {
            expiry: new Date(Date.now() + 120_000).toISOString(),
            minimumToAmount: "0x1",
            fromAmount: "0x1",
          },
          prepared: {
            type: "user-operation-v070",
            from: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
            quote: {
              expiry: new Date(Date.now() + 120_000).toISOString(),
              minimumToAmount: "0x5f5e100",
              fromAmount: "0x5f5e100",
            },
            signatureRequest: {
              type: "personal_sign",
              data: { raw: "0x1234" },
            },
          },
        };
        return mock;
      }

      const headers = await options.getRequestHeaders();
      if (!headers) {
        return { error: "Sign in to swap." };
      }

      const res = await fetch("/api/admin/wallet/swap/quote", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as
        | (WalletSwapQuoteSummary & { error?: string })
        | null;
      if (!res.ok) {
        return { error: json?.error ?? "Could not fetch swap quote." };
      }
      return json as WalletSwapQuoteSummary;
    },

    async submitSwap(input) {
      if (options.previewMode) {
        return { callId: "preview-call-id" };
      }

      const headers = await options.getRequestHeaders();
      if (!headers) {
        return { error: "Sign in to swap." };
      }

      const res = await fetch("/api/admin/wallet/swap/submit", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, chainId: 8453 }),
      });
      const json = (await res.json().catch(() => null)) as
        | { callId?: string; error?: string }
        | null;
      if (!res.ok) {
        return { error: json?.error ?? "Swap submit failed." };
      }
      if (!json?.callId) {
        return { error: "Unexpected swap response." };
      }
      return { callId: json.callId };
    },

    async pollStatus(callId) {
      if (options.previewMode) {
        return { status: 200, txHash: "0xpreview" };
      }

      const headers = await options.getRequestHeaders();
      if (!headers) {
        return { error: "Sign in to swap." };
      }

      const res = await fetch("/api/admin/wallet/swap/status", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { status?: number; receipts?: Array<{ transactionHash?: string }>; error?: string }
        | null;
      if (!res.ok) {
        return { error: json?.error ?? "Could not fetch swap status." };
      }
      return {
        status: json?.status ?? 100,
        txHash: json?.receipts?.[0]?.transactionHash,
      };
    },
  };
}

export type { SwapDirection };
