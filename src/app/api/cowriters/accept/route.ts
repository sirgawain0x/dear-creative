import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { acceptCowriterInvite } from "@/lib/cowriters/accept-invite";
import { requireCowritersEnabled } from "@/lib/cowriters/api-guard";
import { resolveCowriterAcceptIdentityFromToken } from "@/lib/cowriters/privy-identity";
import { extractBearerToken } from "@/lib/privy/verify";

type AcceptBody = {
  token?: string;
};

export async function POST(request: Request) {
  const disabled = requireCowritersEnabled();
  if (disabled) {
    return disabled;
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AcceptBody;
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  let identity;
  try {
    identity = await resolveCowriterAcceptIdentityFromToken(accessToken);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await acceptCowriterInvite(getDb(), token, identity);
  if (!result.ok) {
    const status =
      result.reason === "identity_mismatch" ? 403 : 400;
    return NextResponse.json(
      { error: result.reason },
      { status },
    );
  }

  return NextResponse.json({
    outcome: "accepted",
    postId: result.postId,
    writerId: result.writerId,
  });
}
