import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { posts } from "@/db/schema";
import { createAdamIdea } from "@/lib/adam/ideas";
import { turnIdeaIntoDraft } from "@/lib/adam/gemini-studio";
import { createPostsTestDb } from "@/lib/posts/test-support/posts-test-db";
import { DEFAULT_PAYWALL_SETTINGS } from "./paywall-editor-defaults";
import { applyReaderBodyToPost } from "@/lib/paywall/reader-post";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";

describe("paywall editor defaults", () => {
  it("defaults new editor settings to Free (is_gated false)", () => {
    expect(DEFAULT_PAYWALL_SETTINGS.isGated).toBe(false);
  });

  it("creates new draft posts with is_gated false", async () => {
    const db = await createPostsTestDb();
    const idea = await createAdamIdea(db, {
      title: "Free By Default",
      rawContent: "# Free By Default\nPublic draft body.",
      createdBy: "did:privy:editor",
    });
    const drafted = await turnIdeaIntoDraft(db, {
      ideaId: idea.id,
      actor: "did:privy:editor",
    });
    const [row] = await db
      .select({ isGated: posts.isGated })
      .from(posts)
      .where(eq(posts.id, drafted.draft.postId));
    expect(row?.isGated).toBe(false);
  });

  it("renders full bodyHtml to anonymous readers when post is Free and paywall flag is on", () => {
    setPaywallEnabledForTests(true);
    const fullSecret = "FULL_PUBLIC_BODY_SECRET";
    const post = applyReaderBodyToPost(
      {
        slug: "free-post",
        title: "Free Post",
        publishedAt: "2026-01-01T00:00:00.000Z",
        canonicalUrl: null,
        excerpt: "Teaser",
        teaser: "Teaser",
        coverImage: "/images/default.png",
        readMinutes: 2,
        listenMinutes: 2,
        readingTimeLabel: "2 min read",
        topic: "ai-ownership",
        bodyHtml: `<p>${fullSecret}</p>`,
        audioUrl: null,
        audioVoice: null,
        author: null,
        postId: "p1",
        authorId: null,
        isGated: false,
        freeContent: "ignored when free",
        gatedContent: "NEVER_SHOWN_FOR_FREE",
      },
      false,
    );
    expect(post.bodyHtml).toContain(fullSecret);
    expect(JSON.stringify(post)).not.toContain("NEVER_SHOWN_FOR_FREE");
    setPaywallEnabledForTests(undefined);
  });
});
