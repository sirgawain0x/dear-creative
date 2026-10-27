import { NextResponse } from "next/server";
import { requirePreviewLinksEnabled } from "@/lib/preview-links/api-guard";
import { isPreviewLinksEnabled } from "@/lib/preview-links/feature-flag";

export async function GET() {
  const disabled = requirePreviewLinksEnabled();
  if (disabled) {
    return disabled;
  }
  return NextResponse.json({ enabled: isPreviewLinksEnabled() });
}
