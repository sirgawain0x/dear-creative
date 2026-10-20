import type { DearCreativeDb } from "@/db/client";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";
import { stripHtmlTags } from "@/lib/posts/reading-time";

export class RepurposePostError extends Error {
  constructor(
    readonly code: "not_found" | "ineligible",
    message: string,
  ) {
    super(message);
    this.name = "RepurposePostError";
  }
}

export type RepurposePostSource = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  teaserText: string | null;
  plainText: string;
};

export async function loadRepurposePostSource(
  db: DearCreativeDb,
  postIdOrSlug: string,
): Promise<RepurposePostSource> {
  const post = await getAdminPostByIdOrSlug(db, postIdOrSlug);
  if (!post || post.id.startsWith("content:")) {
    throw new RepurposePostError(
      "not_found",
      "Post not found (save the post to the database first).",
    );
  }
  if (post.status !== "published" && post.status !== "draft") {
    throw new RepurposePostError(
      "ineligible",
      "Only published or draft posts can be repurposed.",
    );
  }

  const body = stripHtmlTags(post.bodyHtml ?? post.emailHtml ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const teaser = post.teaserText?.trim() ?? "";
  const plainText = [post.title.trim(), teaser, body].filter(Boolean).join("\n\n");

  if (!plainText.trim()) {
    throw new RepurposePostError("ineligible", "Post has no text content to repurpose.");
  }

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    status: post.status,
    teaserText: post.teaserText ?? null,
    plainText,
  };
}
