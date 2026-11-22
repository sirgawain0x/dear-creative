import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdamApiToken } from "@/lib/adam/require-auth";
import { ADAM_STUDIO_KEY_COOKIE } from "@/lib/adam/studio-access";

const STUDIO_KEY_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Studio Key fallback for the /adam page gate.
 *
 * Privy sign-in is the normal path. When Privy is unavailable (or the owner is
 * on a machine without the session), entering ADAM_API_TOKEN here sets an
 * httpOnly cookie that the server gate and the studio APIs both accept.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token =
    body && typeof body === "object" && "token" in body
      ? (body as { token?: unknown }).token
      : undefined;
  const trimmed = typeof token === "string" ? token.trim() : "";

  if (!isAdamApiToken(trimmed)) {
    return NextResponse.json(
      { error: "Invalid Studio Key", code: "invalid_studio_key" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ADAM_STUDIO_KEY_COOKIE, trimmed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STUDIO_KEY_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADAM_STUDIO_KEY_COOKIE);
  return NextResponse.json({ ok: true });
}
