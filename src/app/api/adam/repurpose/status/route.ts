import { NextResponse } from "next/server";
import {
  isRepurposeEnabled,
  isRepurposePricingConfigured,
} from "@/lib/adam/repurpose/feature-flag";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";

export async function GET(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    enabled: isRepurposeEnabled(),
    pricingConfigured: isRepurposePricingConfigured(),
  });
}
