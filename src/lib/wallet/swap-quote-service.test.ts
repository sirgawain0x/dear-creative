import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAdminSwapQuote } from "./swap-quote-service";
import {
  resetAlchemyWalletRpcForTests,
  setAlchemyWalletRpcForTests,
} from "./alchemy-wallet-jsonrpc";
import {
  resetSwapDelegationCheckForTests,
  setSwapDelegationCheckForTests,
} from "./swap-delegation";
import {
  resetSwapEthUsdPriceForTests,
  setSwapEthUsdPriceForTests,
} from "./swap-eth-usd-price";
import { WALLET_SWAP_FIXED_ERROR } from "./swap-errors";
import {
  buildMockSwapPreparedUserOp,
  mockUsdcToEthQuoteFields,
  SWAP_VITEST_MOCK_ROUTER,
} from "./swap-test-prepared";
import { SWAP_EXECUTE_TARGET_SELECTORS } from "./swap-constants";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const VALID_TEST_SEAL_SECRET = `vitest-only-${"x".repeat(32)}`;

describe("requestAdminSwapQuote Alchemy constraints", () => {
  beforeEach(() => {
    resetAlchemyWalletRpcForTests();
    resetSwapDelegationCheckForTests();
    resetSwapEthUsdPriceForTests();
    setSwapEthUsdPriceForTests(async () => 3000);
    setSwapDelegationCheckForTests(async () => true);
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    (SWAP_EXECUTE_TARGET_SELECTORS as Record<string, string[]>)[
      SWAP_VITEST_MOCK_ROUTER.toLowerCase()
    ] = ["0x24856bc3"];
  });

  afterEach(() => {
    resetAlchemyWalletRpcForTests();
    resetSwapDelegationCheckForTests();
    resetSwapEthUsdPriceForTests();
    vi.unstubAllEnvs();
  });

  it("rejects when signatureRequest.type is not personal_sign", async () => {
    setAlchemyWalletRpcForTests(async () =>
      buildMockSwapPreparedUserOp({
        from: ADMIN,
        quote: mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString()),
        signatureRequestType: "eth_signTypedData_v4",
      }),
    );

    const result = await requestAdminSwapQuote({
      direction: "USDC_TO_ETH",
      amount: "5",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error).toBe(WALLET_SWAP_FIXED_ERROR);
    }
  });

  it("rejects when Alchemy minimumToAmount is below server minimum", async () => {
    setAlchemyWalletRpcForTests(async () =>
      buildMockSwapPreparedUserOp({
        from: ADMIN,
        quote: {
          ...mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString()),
          minimumToAmount: "0x1",
        },
      }),
    );

    const result = await requestAdminSwapQuote({
      direction: "USDC_TO_ETH",
      amount: "5",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error).toBe(WALLET_SWAP_FIXED_ERROR);
    }
  });
});
