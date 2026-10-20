import { NextResponse } from "next/server";
import { isCowritersEnabled } from "@/lib/cowriters/feature-flag";

export async function GET() {
  return NextResponse.json({ enabled: isCowritersEnabled() });
}
