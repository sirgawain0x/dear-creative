import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import {
  readCreatorPassMembership,
  readCreatorPassMemberships,
  resetCreatorPassReaderForTests,
  setCreatorPassReaderForTests,
} from "./creator-pass";

const WALLET = getAddress("0x2222222222222222222222222222222222222222");
const OTHER = getAddress("0x3333333333333333333333333333333333333333");

beforeEach(() => {
  resetCreatorPassReaderForTests();
});

afterEach(() => {
  resetCreatorPassReaderForTests();
  vi.unstubAllEnvs();
});

describe("creator pass reads", () => {
  it("reports a valid key through the injected reader", async () => {
    const reader = vi.fn(async () => true);
    setCreatorPassReaderForTests(reader);

    const result = await readCreatorPassMembership(WALLET);

    expect(result).toEqual({ address: WALLET, hasValidKey: true });
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("returns false when the wallet has no key", async () => {
    setCreatorPassReaderForTests(async () => false);
    const result = await readCreatorPassMembership(WALLET);
    expect(result?.hasValidKey).toBe(false);
  });

  it("fails closed when the chain read throws", async () => {
    setCreatorPassReaderForTests(async () => {
      throw new Error("rpc down");
    });
    const result = await readCreatorPassMembership(WALLET);
    expect(result).toEqual({ address: WALLET, hasValidKey: false });
  });

  it("fails closed when the chain is unavailable", async () => {
    setCreatorPassReaderForTests(null);
    const result = await readCreatorPassMembership(WALLET);
    expect(result).toEqual({ address: WALLET, hasValidKey: false });
  });

  it("ignores invalid wallet input", async () => {
    setCreatorPassReaderForTests(async () => true);
    expect(await readCreatorPassMembership("not-a-wallet")).toBeNull();
    expect(await readCreatorPassMembership(null)).toBeNull();
  });

  it("caches a positive read briefly", async () => {
    const reader = vi.fn(async () => true);
    setCreatorPassReaderForTests(reader);

    await readCreatorPassMembership(WALLET);
    await readCreatorPassMembership(WALLET.toLowerCase());

    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("can bypass the cache when an immediate re-check is needed", async () => {
    const reader = vi.fn(async () => true);
    setCreatorPassReaderForTests(reader);

    await readCreatorPassMembership(WALLET);
    await readCreatorPassMembership(WALLET, { bypassCache: true });

    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("checks every distinct wallet once", async () => {
    const reader = vi.fn(async () => true);
    setCreatorPassReaderForTests(reader);

    const results = await readCreatorPassMemberships([
      WALLET,
      OTHER,
      WALLET,
      "invalid",
    ]);

    expect(results).toHaveLength(2);
    expect(reader).toHaveBeenCalledTimes(2);
  });
});
