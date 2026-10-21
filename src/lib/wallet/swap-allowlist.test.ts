import { encodeFunctionData, getAddress } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { assertPreparedSwapAllowlisted } from "./swap-allowlist";
import { ALCHEMY_MAV2_V110, BASE_WETH_ADDRESS, SWAP_EXECUTE_TARGET_SELECTORS } from "./swap-constants";
import { MAV2_EXECUTE_ABI } from "./swap-mav2-abi";
import {
  buildMockSwapPreparedUserOp,
  mockUsdcToEthQuoteFields,
  SWAP_VITEST_MOCK_ROUTER,
} from "./swap-test-prepared";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

const QUOTE = mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString());

describe("swap allowlist", () => {
  beforeEach(() => {
    (SWAP_EXECUTE_TARGET_SELECTORS as Record<string, string[]>)[
      SWAP_VITEST_MOCK_ROUTER.toLowerCase()
    ] = ["0x24856bc3"];
  });

  it("allows MAv2 execute targets to USDC with approve to mock router", () => {
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote: QUOTE,
      executeTarget: BASE_USDC_ADDRESS,
    });
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(true);
  });

  it("rejects execute to unknown targets", () => {
    const evil = getAddress("0x1234567890123456789012345678901234567890");
    const inner = encodeFunctionData({
      abi: [
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
      ] as const,
      functionName: "approve",
      args: [SWAP_VITEST_MOCK_ROUTER, BigInt(1)],
    });
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [evil, BigInt(0), inner],
    });
    const prepared = {
      type: "user-operation-v070",
      from: ADMIN,
      data: callData,
      quote: QUOTE,
    };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("rejects disallowed inner selectors on token targets", () => {
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [BASE_WETH_ADDRESS, BigInt(0), "0xdeadbeef"],
    });
    const prepared = { type: "user-operation-v070", from: ADMIN, data: callData, quote: QUOTE };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("rejects empty inner calldata", () => {
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [BASE_WETH_ADDRESS, BigInt(0), "0x"],
    });
    const prepared = { type: "user-operation-v070", from: ADMIN, data: callData, quote: QUOTE };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("rejects transferFrom inner selector", () => {
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [
        BASE_USDC_ADDRESS,
        BigInt(0),
        "0x23b872dd0000000000000000000000000000000000000000000000000000000000000000",
      ],
    });
    const prepared = { type: "user-operation-v070", from: ADMIN, data: callData, quote: QUOTE };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("rejects approve when spender is not an allowlisted router", () => {
    const inner = encodeFunctionData({
      abi: [
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
      ] as const,
      functionName: "approve",
      args: [getAddress("0x2222222222222222222222222222222222222222"), BigInt(1)],
    });
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [BASE_USDC_ADDRESS, BigInt(0), inner],
    });
    const prepared = { type: "user-operation-v070", from: ADMIN, data: callData, quote: QUOTE };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("rejects approve when amount exceeds quote fromAmount", () => {
    const inner = encodeFunctionData({
      abi: [
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
      ] as const,
      functionName: "approve",
      args: [SWAP_VITEST_MOCK_ROUTER, BigInt(QUOTE.fromAmount) + BigInt(1)],
    });
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [BASE_USDC_ADDRESS, BigInt(0), inner],
    });
    const prepared = { type: "user-operation-v070", from: ADMIN, data: callData, quote: QUOTE };
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("requires EIP-7702 delegation pin to MAv2 v1.1.0", () => {
    const prepared = [
      {
        type: "eip7702-authorization",
        contractAddress: "0x69007702764179f14F51cdce752f4f775d74E139",
      },
      buildMockSwapPreparedUserOp({ from: ADMIN, quote: QUOTE }),
    ];
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(false);
  });

  it("allows pinned MAv2 v1.1.0 authorization items", () => {
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote: QUOTE,
      includeAuthorization: true,
    });
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(true);
    expect(ALCHEMY_MAV2_V110).toBeDefined();
  });
});
