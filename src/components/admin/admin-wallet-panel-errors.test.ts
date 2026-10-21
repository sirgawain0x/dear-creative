import { describe, expect, it } from "vitest";
import {
  resolveWalletPanelLoadErrors,
  WALLET_AUTH_ERROR_MESSAGE,
  WALLET_HISTORY_ERROR_MESSAGE,
} from "./admin-wallet-panel-errors";

describe("resolveWalletPanelLoadErrors", () => {
  it("maps 401/403 to auth message", () => {
    expect(
      resolveWalletPanelLoadErrors({
        summaryOk: true,
        summaryStatus: 200,
        historyOk: false,
        historyStatus: 403,
      }).authError,
    ).toBe(WALLET_AUTH_ERROR_MESSAGE);
  });

  it("maps history upstream failure without auth error so balances can render", () => {
    const result = resolveWalletPanelLoadErrors({
      summaryOk: true,
      summaryStatus: 200,
      historyOk: false,
      historyStatus: 502,
    });
    expect(result.authError).toBeNull();
    expect(result.historyError).toBe(WALLET_HISTORY_ERROR_MESSAGE);
    expect(result.summaryError).toBeNull();
  });

  it("maps summary failure separately from history", () => {
    const result = resolveWalletPanelLoadErrors({
      summaryOk: false,
      summaryStatus: 500,
      historyOk: true,
      historyStatus: 200,
    });
    expect(result.summaryError).toBe("Could not load wallet balances.");
    expect(result.historyError).toBeNull();
  });
});
