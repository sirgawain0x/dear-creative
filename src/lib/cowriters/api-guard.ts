import { NextResponse } from "next/server";
import { isCowritersEnabled } from "./feature-flag";

export function cowritersDisabledResponse(): NextResponse {
  return NextResponse.json(
    { error: "Co-writers feature is disabled" },
    { status: 404 },
  );
}

export function requireCowritersEnabled(): NextResponse | null {
  if (!isCowritersEnabled()) {
    return cowritersDisabledResponse();
  }
  return null;
}
