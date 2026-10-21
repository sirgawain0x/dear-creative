import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import {
  assertReaderWalletChainId,
  resolveReaderWalletGateChainId,
} from "./reader-wallet-chain";
import { isReaderWalletEnabled } from "./reader-wallet-feature-flag";
import {
  resolveReaderEmbeddedWalletFromAuthorization,
  type ReaderEmbeddedWallet,
} from "./reader-embedded-wallet";

export type ReaderWalletApiContext = ReaderEmbeddedWallet & {
  chainId: ReturnType<typeof resolveReaderWalletGateChainId>;
};

export type ReaderWalletApiGateResult =
  | { ok: true; ctx: ReaderWalletApiContext }
  | { ok: false; response: NextResponse };

export function readerWalletFeatureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requireReaderWalletApi(
  request: Request,
): Promise<ReaderWalletApiGateResult> {
  if (!isReaderWalletEnabled()) {
    return { ok: false, response: readerWalletFeatureDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request);
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  const wallet = await resolveReaderEmbeddedWalletFromAuthorization(
    request.headers.get("authorization"),
  );
  if (!wallet) {
    const chainId = resolveReaderWalletGateChainId();
    assertReaderWalletChainId(chainId);
    return {
      ok: false,
      response: NextResponse.json(
        {
          configured: false,
          reason: "no_embedded_wallet",
          network: "base",
          chainId,
        },
        { status: 404 },
      ),
    };
  }

  if (wallet.privyUserId !== auth.user.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const chainId = resolveReaderWalletGateChainId();
  assertReaderWalletChainId(chainId);
  return { ok: true, ctx: { ...wallet, chainId } };
}
