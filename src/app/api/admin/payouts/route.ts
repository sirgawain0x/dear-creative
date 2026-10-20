import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { loadAdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";

export async function GET(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await loadAdminPayoutsSnapshot(getDb());
  return NextResponse.json(snapshot);
}
