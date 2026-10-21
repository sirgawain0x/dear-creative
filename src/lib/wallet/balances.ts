import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  type Address,
} from "viem";
import { base } from "viem/chains";
import {
  BASE_USDC_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/payments/subscription-config";
import { alchemyBaseMainnetRpcUrl, WALLET_RPC_TIMEOUT_MS } from "./alchemy-base-rpc";

export type WalletBalances = {
  eth: { raw: string; formatted: string };
  usdc: { raw: string; formatted: string };
};

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(alchemyBaseMainnetRpcUrl(), {
      timeout: WALLET_RPC_TIMEOUT_MS,
    }),
  });
}

let balanceReaderOverride:
  | ((address: Address) => Promise<WalletBalances>)
  | null
  | undefined;

export function setWalletBalanceReaderForTests(
  reader: ((address: Address) => Promise<WalletBalances>) | null,
): void {
  balanceReaderOverride = reader;
}

export function resetWalletBalanceReaderForTests(): void {
  balanceReaderOverride = undefined;
}

export async function fetchWalletBalances(
  address: Address,
): Promise<WalletBalances> {
  if (balanceReaderOverride !== undefined && balanceReaderOverride !== null) {
    return balanceReaderOverride(address);
  }

  const client = createBaseClient();
  const [ethWei, usdcRaw] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: BASE_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);

  return {
    eth: {
      raw: ethWei.toString(),
      formatted: formatUnits(ethWei, 18),
    },
    usdc: {
      raw: usdcRaw.toString(),
      formatted: formatUnits(usdcRaw, USDC_DECIMALS),
    },
  };
}
