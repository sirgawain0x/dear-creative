import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { MAV2_EXECUTE_ABI } from "./swap-mav2-abi";
import { BASE_WETH_ADDRESS, SWAP_USDC } from "./swap-constants";

/** Synthetic router for vitest approve spenders (not a production allowlist entry). */
export const SWAP_VITEST_MOCK_ROUTER = getAddress(
  "0x1111111111111111111111111111111111111111",
);

/**
 * Quote fields for mocked USDC→ETH swaps (amount "5", ETH/USD 3000, default 50 bps slippage).
 * Matches `validateSwapRequestInput` + `assertAlchemyQuoteConstraints` in vitest.
 */
export function mockUsdcToEthQuoteFields(expiry: string): {
  expiry: string;
  fromAmount: string;
  minimumToAmount: string;
} {
  return {
    expiry,
    fromAmount: "0x4c4b40",
    minimumToAmount: "0x5e43ed140a554",
  };
}

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

/** Build a user-operation-style prepared swap payload for mocked tests. */
export function buildMockSwapPreparedUserOp(input: {
  executeTarget?: Address;
  innerData?: Hex;
  quote: { expiry: string; minimumToAmount: string; fromAmount: string };
  from: Address;
  includeAuthorization?: boolean;
  signatureRequestType?: string;
}): Record<string, unknown> | unknown[] {
  const target = input.executeTarget ?? SWAP_USDC;
  const inner =
    input.innerData ??
    encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [SWAP_VITEST_MOCK_ROUTER, BigInt(input.quote.fromAmount)],
    });
  const callData = encodeFunctionData({
    abi: MAV2_EXECUTE_ABI,
    functionName: "execute",
    args: [target, BigInt(0), inner],
  });

  const tx = {
    type: "user-operation-v070",
    from: input.from,
    data: callData,
    quote: input.quote,
    signatureRequest: {
      type: input.signatureRequestType ?? "personal_sign",
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
    args: [BASE_WETH_ADDRESS, BigInt(0), "0x"],
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
