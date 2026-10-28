import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireAuthorProfileEditAccess } from "@/lib/authors/author-access";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import {
  getAuthorProfileById,
  updateAuthorDisplayProfile,
} from "@/lib/authors/author-profile";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAuthorProfilesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const db = getDb();
  const auth = await requireAuthorProfileEditAccess(request, id);
  if (!auth.ok) {
    return auth.response;
  }

  const author = await getAuthorProfileById(db, id);
  if (!author) {
    return NextResponse.json({ error: "Author not found" }, { status: 404 });
  }

  let body: { name?: string; avatarUrl?: string | null };
  try {
    body = (await request.json()) as { name?: string; avatarUrl?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await updateAuthorDisplayProfile(db, id, {
    name: body.name,
    avatarUrl: body.avatarUrl,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const updated = await getAuthorProfileById(db, id);
  return NextResponse.json({ ok: true, author: updated });
}
