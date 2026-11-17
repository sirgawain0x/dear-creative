import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireAdamAuth } from "@/lib/adam/require-auth";
import { publishScheduledPosts } from "@/lib/posts/publish-scheduled-posts";
import { publishedPostCacheTag } from "@/lib/posts/published-posts";

export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    const auth = requireAdamAuth(request);
    if (!auth.ok) return auth.response;
  }

  const result = await publishScheduledPosts(getDb());
  if (result.published.length > 0) {
    revalidateTag("posts-recent", { expire: 0 });
    for (const slug of result.published) {
      revalidateTag(publishedPostCacheTag(slug), { expire: 0 });
    }
  }
  return NextResponse.json(result);
}
