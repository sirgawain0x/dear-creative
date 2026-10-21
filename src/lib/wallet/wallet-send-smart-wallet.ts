import type { Address, Hex } from "viem";

export type WalletSendCall = {
  to: Address;
  value: string;
  data: Hex;
};

export type SmartWalletSendClient = {
  sendTransaction: (input: {
    calls: Array<{ to: Address; value?: bigint; data?: Hex }>;
  }) => Promise<Hex>;
};

export async function sendViaSmartWallet(
  client: SmartWalletSendClient,
  calls: WalletSendCall[],
): Promise<Hex> {
  return client.sendTransaction({
    calls: calls.map((call) => ({
      to: call.to,
      value: BigInt(call.value),
      data: call.data,
    })),
  });
}
