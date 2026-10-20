export const WALLET_AUTH_ERROR_MESSAGE =
  "Could not load wallet (admin Privy session required).";

export const WALLET_HISTORY_ERROR_MESSAGE = "Could not load transfer history.";

export function isWalletAuthHttpStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export type WalletPanelPartialLoadState = {
  summaryStatus: number;
  historyStatus: number;
  summaryOk: boolean;
  historyOk: boolean;
};

export function resolveWalletPanelLoadErrors(
  state: WalletPanelPartialLoadState,
): {
  authError: string | null;
  summaryError: string | null;
  historyError: string | null;
  featureDisabled: boolean;
} {
  if (state.summaryStatus === 404 || state.historyStatus === 404) {
    return {
      authError: null,
      summaryError: null,
      historyError: null,
      featureDisabled: true,
    };
  }

  if (
    isWalletAuthHttpStatus(state.summaryStatus) ||
    isWalletAuthHttpStatus(state.historyStatus)
  ) {
    return {
      authError: WALLET_AUTH_ERROR_MESSAGE,
      summaryError: null,
      historyError: null,
      featureDisabled: false,
    };
  }

  const summaryError =
    state.summaryOk ? null : "Could not load wallet balances.";
  const historyError = state.historyOk ? null : WALLET_HISTORY_ERROR_MESSAGE;

  return {
    authError: null,
    summaryError,
    historyError,
    featureDisabled: false,
  };
}
