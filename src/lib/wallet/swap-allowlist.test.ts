import { encodeFunctionData, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { assertPreparedSwapAllowlisted } from "./swap-allowlist";
import { ALCHEMY_MAV2_V110, BASE_WETH_ADDRESS } from "./swap-constants";
import { MAV2_EXECUTE_ABI } from "./swap-mav2-abi";
import { buildMockSwapPreparedUserOp } from "./swap-test-prepared";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

const QUOTE = {
  expiry: new Date(Date.now() + 60_000).toISOString(),
  minimumToAmount: "0x5f5e100",
  fromAmount: "0x5f5e100",
};

describe("swap allowlist", () => {
  it("allows MAv2 execute targets to USDC with approve selector", () => {
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote: QUOTE,
      executeTarget: BASE_USDC_ADDRESS,
    });
    expect(assertPreparedSwapAllowlisted(prepared, ADMIN).ok).toBe(true);
  });

  it("rejects execute to unknown targets", () => {
    const evil = getAddress("0x1234567890123456789012345678901234567890");
    const inner = "0x095ea7b30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [evil, 0n, inner as `0x${string}`],
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
      args: [BASE_WETH_ADDRESS, 0n, "0xdeadbeef"],
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
