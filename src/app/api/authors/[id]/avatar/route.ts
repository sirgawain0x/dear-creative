import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireAuthorProfileEditAccess } from "@/lib/authors/author-access";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import { updateAuthorDisplayProfile } from "@/lib/authors/author-profile";
import { validateProfileImageUpload } from "@/lib/storage/image-upload-validation";
import { uploadToLensGrove } from "@/lib/storage/lens-grove";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isAuthorProfilesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const db = getDb();
  const auth = await requireAuthorProfileEditAccess(request, db, id);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No image file provided in form field 'file'" },
        { status: 400 },
      );
    }

    const validation = validateProfileImageUpload(file);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const result = await uploadToLensGrove(file, "author-avatar.png");
    await updateAuthorDisplayProfile(db, id, { avatarUrl: result.gatewayUrl });

    return NextResponse.json({
      ok: true,
      url: result.gatewayUrl,
      uri: result.uri,
      storageKey: result.storageKey,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lens Grove upload failed";
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: 500 },
    );
  }
}
