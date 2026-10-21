import { encodeFunctionData, type Address, type Hex } from "viem";
import { MAV2_EXECUTE_ABI } from "./swap-mav2-abi";
import { BASE_WETH_ADDRESS, SWAP_USDC } from "./swap-constants";

/** Build a user-operation-style prepared swap payload for mocked tests. */
export function buildMockSwapPreparedUserOp(input: {
  executeTarget?: Address;
  innerData?: Hex;
  quote: { expiry: string; minimumToAmount: string; fromAmount: string };
  from: Address;
  includeAuthorization?: boolean;
}): Record<string, unknown> | unknown[] {
  const target = input.executeTarget ?? SWAP_USDC;
  const inner = input.innerData ?? "0x095ea7b30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const callData = encodeFunctionData({
    abi: MAV2_EXECUTE_ABI,
    functionName: "execute",
    args: [target, 0n, inner],
  });

  const tx = {
    type: "user-operation-v070",
    from: input.from,
    data: callData,
    quote: input.quote,
    signatureRequest: {
      type: "personal_sign",
      data: { raw: "0x1234" },
    },
  };

  if (input.includeAuthorization) {
    return [
      {
        type: "eip7702-authorization",
        contractAddress: "0x77021100bD87b7008E5E1989d0eB38555d0d0000",
      },
      tx,
    ];
  }

  return tx;
}

export function buildMockSwapPreparedWethExecute(input: {
  from: Address;
  quote: { expiry: string; minimumToAmount: string; fromAmount: string };
}): Record<string, unknown> {
  const callData = encodeFunctionData({
    abi: MAV2_EXECUTE_ABI,
    functionName: "execute",
    args: [BASE_WETH_ADDRESS, 0n, "0x"],
  });
  return {
    type: "user-operation-v070",
    from: input.from,
    data: callData,
    quote: input.quote,
    signatureRequest: {
      type: "personal_sign",
      data: { raw: "0x1234" },
    },
  };
}
