import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getCachedActiveSubscriberCount } from "@/lib/subscribers/cached-active-subscriber-count";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  await connection();
  const activeSubscriberCount = await getCachedActiveSubscriberCount();

  return NextResponse.json(
    { activeSubscriberCount },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    },
  );
}
