import { NextResponse } from "next/server";
import { requireCowritersEnabled } from "@/lib/cowriters/api-guard";
import { isCowritersEnabled } from "@/lib/cowriters/feature-flag";

export async function GET() {
  const disabled = requireCowritersEnabled();
  if (disabled) {
    return disabled;
  }
  return NextResponse.json({ enabled: isCowritersEnabled() });
}
