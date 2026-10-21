export class ReaderCheckoutError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const READER_CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Request body is invalid.",
  unauthorized: "Sign in with your wallet to continue.",
  post_not_found: "Post not found.",
  writer_not_configured: "Writer payout is not configured.",
  unlock_unavailable: "Post unlock is not available.",
  subscription_unavailable: "Subscription is not available for this writer.",
  invalid_tx_hash: "Transaction hash is invalid.",
  tx_not_confirmed: "Transaction is not confirmed yet.",
  tx_not_successful: "Transaction did not succeed.",
  tx_hash_reused: "This transaction was already used.",
  wrong_token: "Payment must be USDC on Base.",
  wrong_recipient: "Payment must go to the writer split address.",
  wrong_amount: "Payment amount does not match the quoted price.",
  wrong_chain: "Payment must be on Base mainnet.",
  payer_mismatch: "Payment must come from your linked wallet.",
  verification_unavailable: "Payment verification is temporarily unavailable.",
};

export function readerCheckoutErrorMessage(code: string): string {
  return READER_CHECKOUT_ERROR_MESSAGES[code] ?? "Payment could not be verified.";
}
