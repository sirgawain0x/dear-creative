import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { base } from "viem/chains";
import {
  CREATOR_PASS_CACHE_TTL_MS,
  CREATOR_PASS_CHAIN_ID,
  CREATOR_PASS_NEGATIVE_CACHE_TTL_MS,
  CREATOR_PASS_RPC_TIMEOUT_MS,
  getCreatorPassChainId,
  getCreatorPassLockAddress,
  normalizeWalletAddress,
  type StudioMembershipCheck,
} from "./studio-access";

/**
 * On-chain Creative Creator Pass reads (Unlock lock on Base).
 *
 * Unlock's canonical membership check is `getHasValidKey(address)`: true while
 * the wallet owns a non-expired key. Reads are cached briefly (positive longer
 * than negative) so page loads and API calls don't hammer the RPC, and every
 * failure is fail-closed — an unreachable chain never grants access.
 */

export const creatorPassAbi = parseAbi([
  "function getHasValidKey(address account) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function keyPrice() view returns (uint256)",
  "function expirationDuration() view returns (uint256)",
]);

type CreatorPassReader = (
  wallet: Address,
  lock: Address,
) => Promise<boolean>;

let readerOverride: CreatorPassReader | null | undefined;

/** Test hook: replace all chain reads (null = simulate unavailable chain). */
export function setCreatorPassReaderForTests(
  reader: CreatorPassReader | null,
): void {
  readerOverride = reader;
}

/** Test hook: clear the reader override and the membership cache. */
export function resetCreatorPassReaderForTests(): void {
  readerOverride = undefined;
  membershipCache.clear();
}

const membershipCache = new Map<
  string,
  { hasValidKey: boolean; expiresAtMs: number }
>();

const MEMBERSHIP_CACHE_MAX_ENTRIES = 500;

function cacheKey(wallet: Address, lock: Address): string {
  return `${lock.toLowerCase()}:${wallet.toLowerCase()}`;
}

function pruneCache(now: number): void {
  if (membershipCache.size <= MEMBERSHIP_CACHE_MAX_ENTRIES) {
    return;
  }
  for (const [key, entry] of membershipCache) {
    if (entry.expiresAtMs <= now) {
      membershipCache.delete(key);
    }
  }
  while (membershipCache.size > MEMBERSHIP_CACHE_MAX_ENTRIES) {
    const oldest = membershipCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    membershipCache.delete(oldest);
  }
}

function rpcUrl(): string {
  const explicit = process.env.CREATOR_PASS_RPC_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const key = process.env.ALCHEMY_API_KEY?.trim();
  return key
    ? `https://base-mainnet.g.alchemy.com/v2/${key}`
    : "https://mainnet.base.org";
}

function publicRpcUrl(): string {
  return "https://mainnet.base.org";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("creator_pass_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readHasValidKeyFrom(
  url: string,
  wallet: Address,
  lock: Address,
): Promise<boolean> {
  const client = createPublicClient({
    chain: base,
    transport: http(url, { timeout: CREATOR_PASS_RPC_TIMEOUT_MS }),
  });
  return await withTimeout(
    client.readContract({
      address: lock,
      abi: creatorPassAbi,
      functionName: "getHasValidKey",
      args: [wallet],
    }),
    CREATOR_PASS_RPC_TIMEOUT_MS,
  );
}

/**
 * Live read with one fallback RPC attempt. Alchemy keys can be origin-locked
 * for server calls, so a transport failure retries the public Base RPC before
 * giving up.
 */
async function readLiveHasValidKey(
  wallet: Address,
  lock: Address,
): Promise<boolean> {
  const primary = rpcUrl();
  try {
    return await readHasValidKeyFrom(primary, wallet, lock);
  } catch (error) {
    if (primary === publicRpcUrl()) {
      throw error;
    }
    return await readHasValidKeyFrom(publicRpcUrl(), wallet, lock);
  }
}

export type CreatorPassMembership = {
  address: Address;
  hasValidKey: boolean;
};

/**
 * Does this wallet hold a valid key on the Creator Pass lock?
 * Never throws: timeouts, reverts and RPC outages resolve to `false`.
 */
export async function readCreatorPassMembership(
  walletInput: string | null | undefined,
  options: { lockAddress?: Address; bypassCache?: boolean } = {},
): Promise<CreatorPassMembership | null> {
  const wallet = normalizeWalletAddress(walletInput);
  if (!wallet) {
    return null;
  }

  const lock = options.lockAddress ?? getCreatorPassLockAddress();
  const key = cacheKey(wallet, lock);
  const now = Date.now();
  if (!options.bypassCache) {
    const cached = membershipCache.get(key);
    if (cached && cached.expiresAtMs > now) {
      return { address: wallet, hasValidKey: cached.hasValidKey };
    }
  }

  let hasValidKey = false;
  try {
    if (readerOverride === null) {
      hasValidKey = false;
    } else if (readerOverride) {
      hasValidKey = await readerOverride(wallet, lock);
    } else if (getCreatorPassChainId() === CREATOR_PASS_CHAIN_ID) {
      hasValidKey = await readLiveHasValidKey(wallet, lock);
    }
  } catch {
    hasValidKey = false;
  }

  membershipCache.set(key, {
    hasValidKey,
    expiresAtMs:
      now +
      (hasValidKey
        ? CREATOR_PASS_CACHE_TTL_MS
        : CREATOR_PASS_NEGATIVE_CACHE_TTL_MS),
  });
  pruneCache(now);

  return { address: wallet, hasValidKey };
}

/** Reads every wallet in parallel (bounded by the RPC timeout). */
export async function readCreatorPassMemberships(
  wallets: readonly string[],
  options: { lockAddress?: Address } = {},
): Promise<StudioMembershipCheck[]> {
  const seen = new Set<string>();
  const results = await Promise.all(
    wallets.map(async (raw) => {
      const address = normalizeWalletAddress(raw);
      if (!address || seen.has(address.toLowerCase())) {
        return null;
      }
      seen.add(address.toLowerCase());
      return readCreatorPassMembership(address, options);
    }),
  );
  return results.filter((row): row is CreatorPassMembership => row !== null);
}
