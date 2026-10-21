import { getAddress } from "viem";
import type {
  WalletSendEstimate,
  WalletSendExecuteInput,
  WalletSendEstimateInput,
  WalletSendPort,
} from "@/components/wallet/wallet-send-types";
import {
  sendViaSmartWallet,
  type SmartWalletSendClient,
} from "./wallet-send-smart-wallet";

type AdminSendApiEstimate = WalletSendEstimate;

type AdminSendApiResponse =
  | { txHash: string; duplicate?: boolean }
  | {
      mode: "client";
      calls: Array<{ to: string; value: string; data: `0x${string}` }>;
      recipient: string;
      amount: string;
      asset: "USDC" | "ETH";
      chain: { network: string; chainId: number };
      gas: { estimatedEth: string; sponsoredByPaymaster: boolean };
    };

export type CreateAdminWalletSendPortOptions = {
  getRequestHeaders: () => Promise<Record<string, string> | null>;
  smartWalletClient?: SmartWalletSendClient | null;
  /** Fixture / screenshot path — no network. */
  previewMode?: boolean;
  estimateUrl?: string;
  sendUrl?: string;
};

export function createAdminWalletSendPort(
  options: CreateAdminWalletSendPortOptions,
): WalletSendPort {
  const estimateUrl = options.estimateUrl ?? "/api/admin/wallet/send/estimate";
  const sendUrl = options.sendUrl ?? "/api/admin/wallet/send";

  return {
    async estimateSend(input: WalletSendEstimateInput) {
      if (options.previewMode) {
        const estimate: AdminSendApiEstimate = {
          recipient: getAddress(input.recipient.trim()),
          amount: input.amount.trim(),
          asset: input.asset,
          warnings: [],
          chain: { network: "base", chainId: 8453 },
          gas: { estimatedEth: "0.000021", sponsoredByPaymaster: true },
        };
        return estimate;
      }

      const headers = await options.getRequestHeaders();
      if (!headers) {
        return { error: "Sign in to send." };
      }

      const res = await fetch(estimateUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        return { error: json?.error ?? "Could not estimate send." };
      }
      return (await res.json()) as AdminSendApiEstimate;
    },

    async executeSend(input: WalletSendExecuteInput) {
      if (options.previewMode) {
        return {
          ok: true,
          txHash:
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        };
      }

      const headers = await options.getRequestHeaders();
      if (!headers) {
        return { ok: false, error: "Sign in to send." };
      }

      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = (await res.json().catch(() => null)) as
        | (AdminSendApiResponse & { error?: string })
        | null;

      if (!res.ok) {
        return { ok: false, error: json?.error ?? "Send request failed." };
      }

      if (json && "txHash" in json && json.txHash) {
        return { ok: true, txHash: json.txHash };
      }

      if (json && "mode" in json && json.mode === "client") {
        if (!options.smartWalletClient) {
          return {
            ok: false,
            error:
              "Smart wallet is not ready. Connect your smart wallet to send.",
          };
        }
        const hash = await sendViaSmartWallet(
          options.smartWalletClient,
          json.calls.map((c) => ({
            to: getAddress(c.to),
            value: c.value,
            data: c.data,
          })),
        );
        return { ok: true, txHash: hash };
      }

      return { ok: false, error: "Unexpected send response." };
    },
  };
}
