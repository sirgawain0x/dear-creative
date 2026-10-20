import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getPostAudioColumns, setPostAudioColumns } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { updateAdminPost } from "./manage-posts";

describe("manage-posts stored narration", () => {
  it("clears audio_url when narration content is edited", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-audio",
      title: "Original title",
      status: "draft",
      publishedAt: null,
      bodyHtml: "<p>Original body</p>",
    });
    const [row] = await db.select().from(posts).where(eq(posts.slug, "draft-audio"));
    expect(row?.id).toBeTruthy();
    const id = row!.id;

    await setPostAudioColumns(db, id, {
      audioUrl: "https://cdn.example/original.mp3",
      audioVoice: "Puck",
    });

    await updateAdminPost(db, id, {
      bodyHtml: "<p>Updated body for narration</p>",
    });

    const audio = await getPostAudioColumns(db, id);
    expect(audio.audioUrl).toBeNull();
    expect(audio.audioVoice).toBeNull();
  });

  it("clears audio_url when a draft is published", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "going-live",
      title: "Going live",
      status: "draft",
      bodyHtml: "<p>Ready</p>",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/draft.mp3",
      audioVoice: "Aoede",
    });

    await updateAdminPost(db, postId, { status: "published" });

    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBeNull();
    expect(audio.audioVoice).toBeNull();
  });

  it("keeps stored audio when the edit does not change narration fields", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "metadata-only",
      title: "Stable title",
      status: "draft",
      bodyHtml: "<p>Stable body</p>",
      emailSubject: "Old subject",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/keep.mp3",
      audioVoice: "Puck",
    });

    await updateAdminPost(db, postId, {
      emailSubject: "Updated subject line",
    });

    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/keep.mp3");
    expect(audio.audioVoice).toBe("Puck");
  });

  it("does not clear audio when audioUrl is set explicitly on the same update", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "explicit-audio",
      title: "Title",
      status: "draft",
      bodyHtml: "<p>Before</p>",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/old.mp3",
      audioVoice: "Puck",
    });

    await updateAdminPost(db, postId, {
      bodyHtml: "<p>After narration change</p>",
      audioUrl: "https://cdn.example/new.mp3",
      audioVoice: "Aoede",
    });

    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/new.mp3");
    expect(audio.audioVoice).toBe("Aoede");
  });
});
