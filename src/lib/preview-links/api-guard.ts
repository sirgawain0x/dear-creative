import { NextResponse } from "next/server";
import { isPreviewLinksEnabled } from "./feature-flag";

export function previewLinksDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function requirePreviewLinksEnabled(): NextResponse | null {
  if (!isPreviewLinksEnabled()) {
    return previewLinksDisabledResponse();
  }
  return null;
}
