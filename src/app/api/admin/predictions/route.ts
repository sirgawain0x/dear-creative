import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { predictions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateOracleIngestBody } from "@/lib/predictions/ingest-validation";
import { requirePrivyAuth } from "@/lib/privy/require-auth";

export async function POST(request: Request) {
  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateOracleIngestBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { questionId, questionText, txHash, articleSlug } = validated.value;

  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.questionId, questionId))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "A prediction with this questionId already exists" },
        { status: 409 },
      );
    }

    const id = randomUUID();
    await db.insert(predictions).values({
      id,
      questionId,
      articleSlug,
      questionText,
      txHash,
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      prediction: {
        id,
        questionId,
        articleSlug,
        status: "pending" as const,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
