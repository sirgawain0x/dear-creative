import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { sendNewsletterEmail } from "@/lib/adam/deliver-email";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";

export const maxDuration = 300;

type DeliverBody = {
  postId?: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: DeliverBody;
  try {
    body = (await request.json()) as DeliverBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postId = body.postId?.trim();
  const idempotencyKey = body.idempotencyKey?.trim();
  if (!postId || !idempotencyKey) {
    return NextResponse.json(
      { error: "postId and idempotencyKey are required" },
      { status: 400 },
    );
  }

  const result = await sendNewsletterEmail(getDb(), {
    postId,
    idempotencyKey,
    dryRun: body.dryRun,
    actor: auth.mode === "adam_token" ? "adam" : auth.actor,
  });

  if (result.outcome === "blocked") {
    const status =
      result.reason === "client_unconfigured"
        ? 503
        : result.reason === "already_delivered" || result.reason === "in_progress"
          ? 409
          : 403;
    return NextResponse.json(
      { error: "Delivery blocked", reason: result.reason },
      { status },
    );
  }

  if (result.outcome === "provider_failed") {
    return NextResponse.json(
      { error: "Provider delivery failed", message: result.errorMessage },
      { status: 502 },
    );
  }

  if (result.outcome === "needs_review") {
    return NextResponse.json(
      { error: "Delivery needs review", message: result.message },
      { status: 409 },
    );
  }

  return NextResponse.json(result);
}
