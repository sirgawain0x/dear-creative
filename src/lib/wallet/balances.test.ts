import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress, HttpRequestError } from "viem";
import {
  fetchWalletBalances,
  resetWalletBalanceReaderForTests,
} from "./balances";

const WALLET = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

const mockGetBalance = vi.hoisted(() => vi.fn());
const mockReadContract = vi.hoisted(() => vi.fn());

vi.mock("viem", async (importOriginal) => {
  const mod = await importOriginal<typeof import("viem")>();
  return {
    ...mod,
    createPublicClient: vi.fn(() => ({
      getBalance: mockGetBalance,
      readContract: mockReadContract,
    })),
  };
});

function collectLoggedStrings(args: unknown[]): string {
  return args
    .flatMap((arg) => {
      if (typeof arg === "string") {
        return [arg];
      }
      try {
        return [JSON.stringify(arg)];
      } catch {
        return [String(arg)];
      }
    })
    .join(" ");
}

describe("fetchWalletBalances", () => {
  beforeEach(() => {
    resetWalletBalanceReaderForTests();
    vi.stubEnv("ALCHEMY_API_KEY", "test-key");
    mockGetBalance.mockReset();
    mockReadContract.mockReset();
  });

  afterEach(() => {
    resetWalletBalanceReaderForTests();
    vi.unstubAllEnvs();
  });

  it("logs sanitized viem HTTP failures without RPC URLs and rethrows", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const httpError = new HttpRequestError({
      url: "https://base-mainnet.g.alchemy.com/v2/FAKEKEY123",
      status: 403,
      details: "Unspecified origin not on whitelist",
    });
    mockGetBalance.mockRejectedValue(httpError);
    mockReadContract.mockResolvedValue(BigInt(0));

    await expect(fetchWalletBalances(WALLET)).rejects.toBe(httpError);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [prefix, payload] = logSpy.mock.calls[0] ?? [];
    expect(prefix).toBe("[wallet] fetch_wallet_balances_failed");
    expect(payload).toEqual({
      errorName: "HttpRequestError",
      httpStatus: 403,
      message: "Unspecified origin not on whitelist",
    });

    const logged = collectLoggedStrings(logSpy.mock.calls[0] ?? []);
    expect(logged).toContain("HttpRequestError");
    expect(logged).toContain("403");
    expect(logged).toContain("Unspecified origin not on whitelist");
    expect(logged).not.toContain("FAKEKEY123");
    expect(logged).not.toContain("alchemy.com/v2");

    logSpy.mockRestore();
  });

  it("returns formatted balances when RPC calls succeed", async () => {
    mockGetBalance.mockResolvedValue(BigInt("42000000000000000"));
    mockReadContract.mockResolvedValue(BigInt("1250500000"));

    await expect(fetchWalletBalances(WALLET)).resolves.toEqual({
      eth: { raw: "42000000000000000", formatted: "0.042" },
      usdc: { raw: "1250500000", formatted: "1250.5" },
    });
  });
});
