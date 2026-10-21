import { getAddress, type Address, type Hex } from "viem";
import type {
  WalletSendEstimate,
  WalletSendExecuteInput,
  WalletSendEstimateInput,
  WalletSendPort,
  WalletSendPrepareResponse,
} from "@/components/wallet/wallet-send-types";
import {
  sendUsdcViaEmbeddedProvider,
  type EmbeddedEthereumProvider,
} from "./wallet-send-embedded";

export type EmbeddedWalletSendExecutor = {
  sendPreparedUsdc: (input: {
    adminWalletAddress: Address;
    prepare: WalletSendPrepareResponse;
    gasSponsorshipAvailable: boolean;
  }) => Promise<Hex>;
};

export type CreateAdminWalletSendPortOptions = {
  getRequestHeaders: () => Promise<Record<string, string> | null>;
  embeddedSend?: EmbeddedWalletSendExecutor | null;
  /** Fixture / screenshot path — no network. */
  previewMode?: boolean;
  estimateUrl?: string;
  sendUrl?: string;
};

export function createDefaultEmbeddedSendExecutor(
  getProvider: () => Promise<EmbeddedEthereumProvider | null>,
  sendTransaction?: (
    input: {
      to: Address;
      data: Hex;
      value: bigint;
      chainId: number;
    },
    options?: { sponsor?: boolean },
  ) => Promise<{ hash: Hex }>,
): EmbeddedWalletSendExecutor {
  return {
    async sendPreparedUsdc({ adminWalletAddress, prepare, gasSponsorshipAvailable }) {
      const tx = prepare.transaction;
      if (sendTransaction) {
        const { hash } = await sendTransaction(
          {
            to: getAddress(tx.to),
            data: tx.data,
            value: BigInt(tx.value),
            chainId: tx.chainId,
          },
          gasSponsorshipAvailable ? { sponsor: true } : undefined,
        );
        return hash;
      }
      const provider = await getProvider();
      if (!provider) {
        throw new Error("Embedded wallet is not ready.");
      }
      return sendUsdcViaEmbeddedProvider(provider, {
        adminWalletAddress,
        transaction: {
          to: getAddress(tx.to),
          data: tx.data,
          value: BigInt(tx.value),
          chainId: tx.chainId,
        },
      });
    },
  };
}

export function createAdminWalletSendPort(
  options: CreateAdminWalletSendPortOptions,
): WalletSendPort {
  const estimateUrl = options.estimateUrl ?? "/api/admin/wallet/send/estimate";
  const sendUrl = options.sendUrl ?? "/api/admin/wallet/send";

  return {
    async estimateSend(input: WalletSendEstimateInput) {
      if (options.previewMode) {
        const estimate: WalletSendEstimate = {
          from: getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6"),
          recipient: getAddress(input.recipient.trim()),
          amount: input.amount.trim(),
          warnings: [],
          chain: { network: "base", chainId: 8453 },
          gas: { estimatedEth: "0.000021", gasSponsorshipAvailable: false },
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
      return (await res.json()) as WalletSendEstimate;
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
        | (WalletSendPrepareResponse & { error?: string })
        | null;

      if (!res.ok) {
        return { ok: false, error: json?.error ?? "Send request failed." };
      }

      if (!json?.transaction) {
        return { ok: false, error: "Unexpected send response." };
      }

      if (!options.embeddedSend) {
        return {
          ok: false,
          error: "Embedded admin wallet is not ready. Sign in with the admin account.",
        };
      }

      try {
        const hash = await options.embeddedSend.sendPreparedUsdc({
          adminWalletAddress: getAddress(json.from),
          prepare: json,
          gasSponsorshipAvailable: json.gas.gasSponsorshipAvailable,
        });
        return { ok: true, txHash: hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Send failed.";
        return { ok: false, error: message };
      }
    },
  };
}
