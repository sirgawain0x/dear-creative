import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";
import { GET } from "./route";

const { getDbMock, getPublishedPostRowBySlugMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getPublishedPostRowBySlugMock: vi.fn(),
}));

const synthesizeSpeechWithGoogleMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/posts/published-posts", () => ({
  getPublishedPostRowBySlug: getPublishedPostRowBySlugMock,
}));

vi.mock("@/lib/paywall/viewer-from-cookies", () => ({
  resolvePostViewerFromCookies: vi.fn(async () => null),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

vi.mock("@/lib/adam/gemini-studio", () => ({
  synthesizeSpeechWithGoogle: synthesizeSpeechWithGoogleMock,
}));

describe("GET /api/posts/[slug]/audio", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
  });

  it("returns stored audio metadata when audio_url is set", async () => {
    const db = { tag: "db" };
    getDbMock.mockReturnValue(db);
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "hello",
      title: "Hello",
      isGated: false,
      authorId: null,
      postId: "p1",
      audioUrl: "https://cdn.example/narration.mp3",
      audioVoice: "Puck",
    });

    const response = await GET(
      new Request("http://localhost/api/posts/hello/audio?voice=Aoede"),
      { params: Promise.resolve({ slug: "hello" }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      audioUrl: string;
      voice: string;
      preGenerated: boolean;
    };
    expect(body).toMatchObject({
      audioUrl: "https://cdn.example/narration.mp3",
      voice: "Puck",
      preGenerated: true,
    });
    expect(synthesizeSpeechWithGoogleMock).not.toHaveBeenCalled();
  });

  it("returns 403 for gated posts when paywall is enabled and viewer lacks access", async () => {
    setPaywallEnabledForTests(true);
    getDbMock.mockReturnValue({});
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "gated",
      title: "Gated",
      isGated: true,
      authorId: "w1",
      postId: "p1",
      audioUrl: "https://cdn.example/gated.mp3",
      audioVoice: "Puck",
    });

    const response = await GET(
      new Request("http://localhost/api/posts/gated/audio"),
      { params: Promise.resolve({ slug: "gated" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 and does not call TTS when the post has no stored audio", async () => {
    getDbMock.mockReturnValue({});
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "no-audio",
      title: "No Audio",
      isGated: false,
      authorId: null,
      postId: "p1",
      bodyHtml: "<p>Body</p>",
      audioUrl: null,
      audioVoice: null,
    });

    const response = await GET(
      new Request("http://localhost/api/posts/no-audio/audio"),
      { params: Promise.resolve({ slug: "no-audio" }) },
    );

    expect(response.status).toBe(404);
    expect(synthesizeSpeechWithGoogleMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the post is not published", async () => {
    getPublishedPostRowBySlugMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/posts/missing/audio"),
      { params: Promise.resolve({ slug: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(synthesizeSpeechWithGoogleMock).not.toHaveBeenCalled();
  });
});
