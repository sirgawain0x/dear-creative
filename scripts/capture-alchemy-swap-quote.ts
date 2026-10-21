/**
 * Quote-only capture for Base admin ETH↔USDC swaps (wallet_requestQuote_v0).
 * Requires ALCHEMY_API_KEY and ADMIN_WALLET_ADDRESS in the environment.
 * Never calls sendPreparedCalls, sign, or submit.
 *
 * Usage:
 *   ALCHEMY_API_KEY=... ADMIN_WALLET_ADDRESS=0x... npx tsx scripts/capture-alchemy-swap-quote.ts
 */
import { writeFileSync } from "node:fs";
import { getAddress } from "viem";
import { decodePreparedSwapExecuteTargets } from "../src/lib/wallet/swap-decode-allowlist";
import {
  ALCHEMY_NATIVE_ETH_TOKEN,
  BASE_CHAIN_ID_HEX,
} from "../src/lib/wallet/swap-constants";
import { BASE_USDC_ADDRESS } from "../src/lib/payments/subscription-config";

const ADMIN = process.env.ADMIN_WALLET_ADDRESS?.trim();
const KEY = process.env.ALCHEMY_API_KEY?.trim();

if (!KEY || !ADMIN) {
  console.error("Set ALCHEMY_API_KEY and ADMIN_WALLET_ADDRESS to capture quotes.");
  process.exit(1);
}

async function requestQuote(params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.g.alchemy.com/v2/${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "wallet_requestQuote_v0",
      params: [params],
    }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) {
    throw new Error(json.error.message);
  }
  return json.result;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.toLowerCase().includes("secret") || k.toLowerCase().includes("apikey")) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

async function capture(direction: "USDC_TO_ETH" | "ETH_TO_USDC") {
  const from = getAddress(ADMIN);
  const isUsdcToEth = direction === "USDC_TO_ETH";
  const params = {
    from,
    chainId: BASE_CHAIN_ID_HEX,
    fromToken: isUsdcToEth ? BASE_USDC_ADDRESS : ALCHEMY_NATIVE_ETH_TOKEN,
    toToken: isUsdcToEth ? ALCHEMY_NATIVE_ETH_TOKEN : BASE_USDC_ADDRESS,
    fromAmount: isUsdcToEth ? "0x5f5e100" : "0x2386f26fc10000",
    minimumToAmount: isUsdcToEth ? "0x2386f26fc10000" : "0x4c4b400",
    capabilities: {
      eip7702Auth: {
        delegation: "ModularAccountV2",
        version: "v1.1.0",
      },
    },
  };

  const result = await requestQuote(params);
  const decoded = decodePreparedSwapExecuteTargets(result);
  const payload = {
    capturedAt: new Date().toISOString(),
    direction,
    request: params,
    response: redact(result),
    decodedTargets: decoded,
  };

  const path = `src/lib/wallet/fixtures/alchemy-swap-quote-${direction.toLowerCase()}.json`;
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${path} (${decoded.length} execute targets decoded)`);
}

async function main() {
  await capture("USDC_TO_ETH");
  await capture("ETH_TO_USDC");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
