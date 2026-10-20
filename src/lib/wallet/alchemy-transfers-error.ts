export type AlchemyTransfersErrorCode = "http_error" | "rpc_error" | "network_error";

export class AlchemyTransfersError extends Error {
  readonly code: AlchemyTransfersErrorCode;
  readonly httpStatus: number | null;
  readonly alchemyMessage: string | null;

  constructor(
    code: AlchemyTransfersErrorCode,
    options: { httpStatus?: number | null; alchemyMessage?: string | null; cause?: unknown } = {},
  ) {
    const detail = options.alchemyMessage?.trim();
    super(
      code === "http_error"
        ? "alchemy_transfers_http_error"
        : code === "rpc_error"
          ? "alchemy_transfers_error"
          : "alchemy_transfers_network_error",
    );
    this.name = "AlchemyTransfersError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
    this.alchemyMessage = detail ?? null;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function logAlchemyTransfersFailure(details: {
  httpStatus: number | null;
  message: string | null;
  code: AlchemyTransfersErrorCode;
}): void {
  console.error("[admin-wallet] alchemy_getAssetTransfers failed", {
    code: details.code,
    httpStatus: details.httpStatus,
    message: details.message,
  });
}
