import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getDbMock, getPublishedPostBySlugMock, getPostAudioColumnsMock } =
  vi.hoisted(() => ({
    getDbMock: vi.fn(),
    getPublishedPostBySlugMock: vi.fn(),
    getPostAudioColumnsMock: vi.fn(),
  }));

const synthesizeSpeechWithGoogleMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/posts/published-posts", () => ({
  getPublishedPostBySlug: getPublishedPostBySlugMock,
}));

vi.mock("@/db/ensure-schema", () => ({
  getPostAudioColumns: getPostAudioColumnsMock,
}));

vi.mock("@/lib/adam/gemini-studio", () => ({
  synthesizeSpeechWithGoogle: synthesizeSpeechWithGoogleMock,
}));

describe("GET /api/posts/[slug]/audio", () => {
  it("returns stored audio metadata when audio_url is set", async () => {
    const db = { tag: "db" };
    getDbMock.mockReturnValue(db);
    getPublishedPostBySlugMock.mockResolvedValue({
      slug: "hello",
      title: "Hello",
    });
    getPostAudioColumnsMock.mockResolvedValue({
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
    expect(getPostAudioColumnsMock).toHaveBeenCalledWith(db, "hello");
    expect(synthesizeSpeechWithGoogleMock).not.toHaveBeenCalled();
  });

  it("returns 404 and does not call TTS when the post has no stored audio", async () => {
    getDbMock.mockReturnValue({});
    getPublishedPostBySlugMock.mockResolvedValue({
      slug: "no-audio",
      title: "No Audio",
      bodyHtml: "<p>Body</p>",
    });
    getPostAudioColumnsMock.mockResolvedValue({
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
    getPublishedPostBySlugMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/posts/missing/audio"),
      { params: Promise.resolve({ slug: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(getPostAudioColumnsMock).not.toHaveBeenCalled();
    expect(synthesizeSpeechWithGoogleMock).not.toHaveBeenCalled();
  });
});
