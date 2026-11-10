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

function createBaseClient(rpcUrl: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      timeout: WALLET_RPC_TIMEOUT_MS,
    }),
  });
}

function logWalletBalanceFetchFailure(error: unknown): void {
  const errorName =
    error instanceof Error
      ? error.name || error.constructor.name
      : "UnknownError";

  let httpStatus: number | null = null;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      httpStatus = status;
    }
  }

  let message: string | null = null;
  if (error && typeof error === "object" && "details" in error) {
    const details = (error as { details?: unknown }).details;
    if (typeof details === "string" && details.trim()) {
      message = details.trim();
    }
  }
  if (!message && error instanceof Error && "shortMessage" in error) {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string" && shortMessage.trim()) {
      message = shortMessage.trim();
    }
  }

  console.error("[wallet] fetch_wallet_balances_failed", {
    errorName,
    httpStatus,
    message,
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
  { allowPublicFallback = false } = {},
): Promise<WalletBalances> {
  if (balanceReaderOverride !== undefined && balanceReaderOverride !== null) {
    return balanceReaderOverride(address);
  }

  const rpcUrl = alchemyBaseMainnetRpcUrl();
  const publicRpcUrl = base.rpcUrls.default.http[0];
  try {
    return await readBalances(address, rpcUrl);
  } catch (error) {
    logWalletBalanceFetchFailure(error);
    if (!allowPublicFallback || rpcUrl === publicRpcUrl) throw error;
    try {
      return await readBalances(address, publicRpcUrl);
    } catch (fallbackError) {
      logWalletBalanceFetchFailure(fallbackError);
      throw fallbackError;
    }
  }
}

async function readBalances(address: Address, rpcUrl: string): Promise<WalletBalances> {
  const client = createBaseClient(rpcUrl);
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
