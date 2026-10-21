import {
  createWalletClient,
  custom,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

export const BASE_CHAIN_ID = 8453;

export type EmbeddedWalletSendInput = {
  adminWalletAddress: Address;
  transaction: {
    to: Address;
    data: Hex;
    value: bigint;
    chainId: number;
  };
  sponsor?: boolean;
};

export type EmbeddedEthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function assertEmbeddedSignerIsAdmin(
  provider: EmbeddedEthereumProvider,
  adminWalletAddress: Address,
): Promise<Address> {
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const first = accounts[0];
  if (!first) {
    throw new Error("Embedded wallet is not connected.");
  }
  const signer = getAddress(first);
  if (signer.toLowerCase() !== adminWalletAddress.toLowerCase()) {
    throw new Error(
      "Connected wallet does not match the configured admin embedded wallet.",
    );
  }
  return signer;
}

export async function ensureBaseChain(
  provider: EmbeddedEthereumProvider,
): Promise<void> {
  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  const current = Number.parseInt(chainIdHex, 16);
  if (current === BASE_CHAIN_ID) {
    return;
  }
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
  });
  const afterHex = (await provider.request({ method: "eth_chainId" })) as string;
  const after = Number.parseInt(afterHex, 16);
  if (after !== BASE_CHAIN_ID) {
    throw new Error("Wallet must be on Base (chain 8453) to send.");
  }
}

export async function sendUsdcViaEmbeddedProvider(
  provider: EmbeddedEthereumProvider,
  input: EmbeddedWalletSendInput,
): Promise<Hex> {
  await ensureBaseChain(provider);
  await assertEmbeddedSignerIsAdmin(provider, input.adminWalletAddress);

  if (input.transaction.chainId !== BASE_CHAIN_ID) {
    throw new Error("Transaction must target Base (chain 8453).");
  }

  const client = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  const hash = await client.sendTransaction({
    account: input.adminWalletAddress,
    to: input.transaction.to,
    data: input.transaction.data,
    value: input.transaction.value,
    chain: base,
  });

  return hash;
}
