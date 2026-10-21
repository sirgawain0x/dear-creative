import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";
import { GET } from "./route";

const { getDbMock, getPublishedPostRowBySlugMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getPublishedPostRowBySlugMock: vi.fn(),
}));

const canReadFullMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/posts/published-posts", () => ({
  getPublishedPostRowBySlug: getPublishedPostRowBySlugMock,
}));

vi.mock("@/lib/paywall/viewer-from-cookies", () => ({
  resolvePostViewerFromCookies: vi.fn(async () => null),
}));

vi.mock("@/lib/paywall/can-read-full", () => ({
  canReadFull: canReadFullMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

const STORED_MP3 = "https://cdn.example/narration.mp3";

describe("GET /api/posts/[slug]/audio", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    canReadFullMock.mockReset();
  });

  it("redirects to stored audio (302 Location) when audio_url is set", async () => {
    getDbMock.mockReturnValue({});
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "hello",
      title: "Hello",
      isGated: false,
      authorId: null,
      postId: "p1",
      audioUrl: STORED_MP3,
      audioVoice: "Puck",
    });

    const response = await GET(
      new Request("http://localhost/api/posts/hello/audio"),
      { params: Promise.resolve({ slug: "hello" }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(STORED_MP3);
  });

  it("redirects entitled readers on gated posts (player src follows Location)", async () => {
    setPaywallEnabledForTests(true);
    canReadFullMock.mockResolvedValue(true);
    getDbMock.mockReturnValue({});
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "gated-unlocked",
      title: "Gated",
      isGated: true,
      authorId: "w1",
      postId: "p1",
      audioUrl: STORED_MP3,
      audioVoice: "Puck",
    });

    const response = await GET(
      new Request("http://localhost/api/posts/gated-unlocked/audio"),
      { params: Promise.resolve({ slug: "gated-unlocked" }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(STORED_MP3);
  });

  it("returns 403 without redirect for locked gated posts", async () => {
    setPaywallEnabledForTests(true);
    canReadFullMock.mockResolvedValue(false);
    getDbMock.mockReturnValue({});
    getPublishedPostRowBySlugMock.mockResolvedValue({
      slug: "gated",
      title: "Gated",
      isGated: true,
      authorId: "w1",
      postId: "p1",
      audioUrl: STORED_MP3,
      audioVoice: "Puck",
    });

    const response = await GET(
      new Request("http://localhost/api/posts/gated/audio"),
      { params: Promise.resolve({ slug: "gated" }) },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("returns 404 when the post has no stored audio", async () => {
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
  });

  it("returns 404 when the post is not published", async () => {
    getPublishedPostRowBySlugMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/posts/missing/audio"),
      { params: Promise.resolve({ slug: "missing" }) },
    );

    expect(response.status).toBe(404);
  });
});
