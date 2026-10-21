import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { subscriptionPlanEnum } from "@/db/schema";
import { resolvePaymentsLinkedWallet } from "@/lib/payments/privy-linked-wallet";
import { isPaywallEnabled } from "@/lib/paywall/feature-flag";
import { paywallDisabledResponse } from "@/lib/paywall/paywall-disabled-response";
import {
  ReaderCheckoutError,
  readerCheckoutErrorMessage,
} from "@/lib/paywall/reader-checkout-errors";
import { verifyAndRecordSubscription } from "@/lib/paywall/reader-checkout-service";

function parseBody(
  body: unknown,
): { writerId: string; plan: "monthly" | "yearly"; txHash: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const writerId =
    typeof record.writerId === "string" ? record.writerId.trim() : "";
  const plan = typeof record.plan === "string" ? record.plan.trim() : "";
  const txHash = typeof record.txHash === "string" ? record.txHash.trim() : "";
  if (
    !writerId ||
    !txHash ||
    !(subscriptionPlanEnum as readonly string[]).includes(plan)
  ) {
    return null;
  }
  return { writerId, plan: plan as "monthly" | "yearly", txHash };
}

export async function POST(request: Request) {
  if (!isPaywallEnabled()) {
    return paywallDisabledResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: readerCheckoutErrorMessage("invalid_body"),
        code: "invalid_body",
      },
      { status: 400 },
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      {
        error: readerCheckoutErrorMessage("invalid_body"),
        code: "invalid_body",
      },
      { status: 400 },
    );
  }

  const linked = await resolvePaymentsLinkedWallet(
    request.headers.get("authorization"),
    typeof (body as Record<string, unknown>).walletAddress === "string"
      ? ((body as Record<string, unknown>).walletAddress as string)
      : undefined,
  );
  if (!linked) {
    return NextResponse.json(
      {
        error: readerCheckoutErrorMessage("unauthorized"),
        code: "unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const result = await verifyAndRecordSubscription(getDb(), {
      writerId: parsed.writerId,
      plan: parsed.plan,
      txHash: parsed.txHash,
      walletAddress: linked.signerAddress,
      privyUserId: linked.privyUserId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ReaderCheckoutError) {
      const headers =
        error.retryAfterSeconds !== undefined
          ? { "Retry-After": String(error.retryAfterSeconds) }
          : undefined;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    }
    throw error;
  }
}
