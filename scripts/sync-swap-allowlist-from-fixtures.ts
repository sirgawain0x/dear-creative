/**
 * Merge router rows in swap-constants from captured quote fixtures.
 * Run after: npx tsx scripts/capture-alchemy-swap-quote.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getAddress } from "viem";

const FIXTURE_PATHS = [
  "src/lib/wallet/fixtures/alchemy-swap-quote-usdc_to_eth.json",
  "src/lib/wallet/fixtures/alchemy-swap-quote-eth_to_usdc.json",
];

const TOKEN_LOWERS = new Set([
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
  "0x4200000000000000000000000000000000000006", // WETH
]);

type Decoded = { target: string; selector: string };

function loadDecoded(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const path of FIXTURE_PATHS) {
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      console.error(`Missing fixture: ${path}`);
      process.exit(1);
    }
    const parsed = JSON.parse(raw) as { decodedTargets?: Decoded[] };
    for (const row of parsed.decodedTargets ?? []) {
      const target = getAddress(row.target).toLowerCase();
      if (TOKEN_LOWERS.has(target)) {
        continue;
      }
      const sel = row.selector.toLowerCase();
      if (!map.has(target)) {
        map.set(target, new Set());
      }
      map.get(target)!.add(sel);
    }
  }
  return map;
}

function formatRouterBlock(routers: Map<string, Set<string>>): string {
  const lines: string[] = [];
  for (const [target, selectors] of [...routers.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const checksummed = getAddress(target);
    const selList = [...selectors].sort().map((s) => `"${s}"`).join(", ");
    lines.push(
      `  // wallet_requestQuote_v0 capture — see src/lib/wallet/fixtures/alchemy-swap-quote-*.json`,
    );
    lines.push(`  [${checksummed.toLowerCase()}]: [${selList}],`);
  }
  return lines.join("\n");
}

const routers = loadDecoded();
if (routers.size === 0) {
  console.error("No router targets decoded from fixtures.");
  process.exit(1);
}

const constantsPath = "src/lib/wallet/swap-constants.ts";
const src = readFileSync(constantsPath, "utf8");
const marker = "export const SWAP_EXECUTE_TARGET_SELECTORS";
const start = src.indexOf(marker);
if (start === -1) {
  console.error("Could not find SWAP_EXECUTE_TARGET_SELECTORS in swap-constants.ts");
  process.exit(1);
}
const openBrace = src.indexOf("{", start);
const closeBrace = src.indexOf("};", openBrace);
if (openBrace === -1 || closeBrace === -1) {
  console.error("Could not parse SWAP_EXECUTE_TARGET_SELECTORS block");
  process.exit(1);
}

const tokenBlock = `  [SWAP_USDC.toLowerCase()]: [
    "0x095ea7b3", // approve(address,uint256)
    "0xa9059cbb", // transfer(address,uint256)
  ],
  [BASE_WETH_ADDRESS.toLowerCase()]: [
    "0x095ea7b3", // approve(address,uint256)
    "0xd0e30db0", // deposit()
    "0x2e1a7d4d", // withdraw(uint256)
  ],
${formatRouterBlock(routers)}`;

const next = `${src.slice(0, openBrace + 1)}\n${tokenBlock}\n${src.slice(closeBrace)}`;
writeFileSync(constantsPath, next);
console.log(`Updated ${constantsPath} with ${routers.size} router target(s).`);
