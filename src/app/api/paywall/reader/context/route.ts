import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isPaywallEnabled } from "@/lib/paywall/feature-flag";
import { paywallDisabledResponse } from "@/lib/paywall/paywall-disabled-response";
import { loadReaderCheckoutContext } from "@/lib/paywall/reader-checkout-service";

export async function GET(request: Request) {
  if (!isPaywallEnabled()) {
    return paywallDisabledResponse();
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: "slug query parameter is required", code: "invalid_query" },
      { status: 400 },
    );
  }

  const context = await loadReaderCheckoutContext(getDb(), slug);
  if (!context) {
    return NextResponse.json(
      { error: "Post not found", code: "post_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(context);
}
