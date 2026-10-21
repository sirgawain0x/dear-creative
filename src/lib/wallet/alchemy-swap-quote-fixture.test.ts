import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { BASE_WETH_ADDRESS, SWAP_EXECUTE_TARGET_SELECTORS } from "./swap-constants";

const FIXTURES = [
  "src/lib/wallet/fixtures/alchemy-swap-quote-usdc_to_eth.json",
  "src/lib/wallet/fixtures/alchemy-swap-quote-eth_to_usdc.json",
] as const;

const TOKEN_LOWERS = new Set([
  BASE_USDC_ADDRESS.toLowerCase(),
  BASE_WETH_ADDRESS.toLowerCase(),
]);

const fixturesPresent = FIXTURES.every((path) => existsSync(path));

describe.skipIf(!fixturesPresent)("Alchemy swap quote fixtures", () => {
  it("allowlists every decoded router target and selector from captures", () => {
    for (const path of FIXTURES) {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as {
        decodedTargets?: { target: string; selector: string }[];
      };
      for (const row of parsed.decodedTargets ?? []) {
        const target = getAddress(row.target).toLowerCase();
        if (TOKEN_LOWERS.has(target)) {
          continue;
        }
        const allowed = SWAP_EXECUTE_TARGET_SELECTORS[target];
        expect(allowed, `${path} router ${target}`).toBeDefined();
        expect(allowed?.map((s) => s.toLowerCase())).toContain(row.selector.toLowerCase());
      }
    }
  });
});
