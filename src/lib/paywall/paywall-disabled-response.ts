import { NextResponse } from "next/server";

/** Paywall API routes return 404 when PAYWALL_ENABLED is not exactly "true". */
export function paywallDisabledResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
