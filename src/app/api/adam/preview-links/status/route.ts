import { NextResponse } from "next/server";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requirePreviewLinksEnabled } from "@/lib/preview-links/api-guard";
import { isPreviewLinksEnabled } from "@/lib/preview-links/feature-flag";

export async function GET(request: Request) {
  const disabled = requirePreviewLinksEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({ enabled: isPreviewLinksEnabled() });
}
