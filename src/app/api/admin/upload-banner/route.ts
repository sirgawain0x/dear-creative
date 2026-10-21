import { NextResponse } from "next/server";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { validateProfileImageUpload } from "@/lib/storage/image-upload-validation";
import { uploadToLensGrove } from "@/lib/storage/lens-grove";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
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
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const result = await uploadToLensGrove(file);

    return NextResponse.json({
      ok: true,
      url: result.gatewayUrl,
      uri: result.uri,
      storageKey: result.storageKey,
      actor: auth.actor,
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
