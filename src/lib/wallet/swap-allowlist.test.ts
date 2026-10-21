import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import {
  assertSwapCallTargetsAllowlisted,
  collectSwapCallTargets,
} from "./swap-allowlist";
import { ALCHEMY_MAV2_V110 } from "./swap-constants";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("swap allowlist", () => {
  it("allows documented USDC and MAv2 targets", () => {
    const payload = {
      calls: [{ to: BASE_USDC_ADDRESS }, { to: ALCHEMY_MAV2_V110 }],
    };
    const targets = collectSwapCallTargets(payload);
    const result = assertSwapCallTargetsAllowlisted(targets, ADMIN);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown router targets", () => {
    const evil = getAddress("0x1234567890123456789012345678901234567890");
    const result = assertSwapCallTargetsAllowlisted([evil], ADMIN);
    expect(result.ok).toBe(false);
  });
});
