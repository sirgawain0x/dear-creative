import {
  createPublicClient,
  formatEther,
  http,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { alchemyBaseMainnetRpcUrl, WALLET_RPC_TIMEOUT_MS } from "./alchemy-base-rpc";
import type { AdminWalletSendCall } from "./send-validation";

let gasEstimateOverride:
  | ((from: Address, calls: AdminWalletSendCall[]) => Promise<bigint>)
  | null
  | undefined;

export function setWalletSendGasEstimateForTests(
  fn: ((from: Address, calls: AdminWalletSendCall[]) => Promise<bigint>) | null,
): void {
  gasEstimateOverride = fn;
}

export function resetWalletSendGasEstimateForTests(): void {
  gasEstimateOverride = undefined;
}

export async function estimateAdminWalletSendGas(
  from: Address,
  calls: AdminWalletSendCall[],
): Promise<{ gasWei: bigint; gasEthFormatted: string }> {
  if (gasEstimateOverride !== undefined && gasEstimateOverride !== null) {
    const gasWei = await gasEstimateOverride(from, calls);
    return { gasWei, gasEthFormatted: formatEther(gasWei) };
  }

  const client = createPublicClient({
    chain: base,
    transport: http(alchemyBaseMainnetRpcUrl(), {
      timeout: WALLET_RPC_TIMEOUT_MS,
    }),
  });

  let total = BigInt(0);
  for (const call of calls) {
    const gas = await client.estimateGas({
      account: from,
      to: call.to,
      value: call.value,
      data: call.data,
    });
    total += gas;
  }

  return { gasWei: total, gasEthFormatted: formatEther(total) };
}
