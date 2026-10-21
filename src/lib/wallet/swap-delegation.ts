import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { alchemyBaseMainnetRpcUrl, WALLET_RPC_TIMEOUT_MS } from "./alchemy-base-rpc";
import { ALCHEMY_MAV2_V100, ALCHEMY_MAV2_V110 } from "./swap-constants";

let delegationCheckOverride:
  | ((address: Address) => Promise<boolean>)
  | null
  | undefined;

export function setSwapDelegationCheckForTests(
  fn: ((address: Address) => Promise<boolean>) | null,
): void {
  delegationCheckOverride = fn;
}

export function resetSwapDelegationCheckForTests(): void {
  delegationCheckOverride = undefined;
}

/** True when the admin EOA is already EIP-7702 delegated to Alchemy MAv2. */
export async function isAdminWalletDelegatedToMav2(address: Address): Promise<boolean> {
  if (delegationCheckOverride !== undefined && delegationCheckOverride !== null) {
    return delegationCheckOverride(address);
  }

  const client = createPublicClient({
    chain: base,
    transport: http(alchemyBaseMainnetRpcUrl(), {
      timeout: WALLET_RPC_TIMEOUT_MS,
    }),
  });

  const code = await client.getCode({ address });
  if (!code || code === "0x") {
    return false;
  }
  const lower = code.toLowerCase();
  return (
    lower.includes(ALCHEMY_MAV2_V110.slice(2).toLowerCase()) ||
    lower.includes(ALCHEMY_MAV2_V100.slice(2).toLowerCase())
  );
}
