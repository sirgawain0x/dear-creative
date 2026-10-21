import type { Address, Hex } from "viem";
import { base } from "viem/chains";

export type ClientSendCall = {
  to: Address;
  value: string;
  data: Hex;
};

export type SmartWalletSendClient = {
  sendTransaction: (input: {
    calls: Array<{ to: Address; value?: bigint; data?: Hex }>;
  }) => Promise<Hex>;
};

/**
 * Sends via Privy smart wallet client (Alchemy bundler + paymaster configured in Privy).
 * Injected in tests; production passes useSmartWallets().client.
 */
export async function sendAdminWalletViaSmartWallet(
  client: SmartWalletSendClient,
  calls: ClientSendCall[],
): Promise<Hex> {
  return client.sendTransaction({
    calls: calls.map((call) => ({
      to: call.to,
      value: BigInt(call.value),
      data: call.data,
    })),
  });
}

export const ADMIN_WALLET_SEND_CHAIN = base;
