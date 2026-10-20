import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesizeNarrationSpeechChunk } from "./narration-synthesize";

const kokoroMock = vi.hoisted(() => vi.fn());
const geminiMock = vi.hoisted(() => vi.fn());

vi.mock("./kokoro-server-tts", () => ({
  synthesizeSpeechWithKokoroServer: kokoroMock,
  isKokoroServerConfigured: () => true,
}));

vi.mock("@/lib/adam/gemini-studio", () => ({
  synthesizeSpeechWithGoogle: geminiMock,
}));

describe("synthesizeNarrationSpeechChunk", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    kokoroMock.mockReset();
    geminiMock.mockReset();
  });

  it("calls Kokoro when NARRATION_PROVIDER=kokoro", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    kokoroMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/mpeg",
      provider: "kokoro-cloud-run",
    });

    const result = await synthesizeNarrationSpeechChunk({
      text: "Dispatch.",
      voiceName: "af_heart",
    });

    expect(kokoroMock).toHaveBeenCalledTimes(1);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("kokoro-cloud-run");
  });

  it("falls back to Gemini when Kokoro fails and NARRATION_GEMINI_FALLBACK=true", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "true");
    kokoroMock.mockRejectedValue(new Error("cloud run 503"));
    geminiMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "gemini",
    });

    const result = await synthesizeNarrationSpeechChunk({
      text: "Fallback path.",
      voiceName: "Puck",
    });

    expect(kokoroMock).toHaveBeenCalledTimes(1);
    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toContain("kokoro-fallback");
  });

  it("skips Gemini when Kokoro fails and fallback is disabled", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "false");
    kokoroMock.mockRejectedValue(new Error("cloud run 503"));

    await expect(
      synthesizeNarrationSpeechChunk({
        text: "No fallback.",
        voiceName: "af_heart",
      }),
    ).rejects.toThrow("cloud run 503");

    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("uses Gemini only when NARRATION_PROVIDER=gemini", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "gemini");
    geminiMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "gemini",
    });

    await synthesizeNarrationSpeechChunk({
      text: "Gemini only.",
      voiceName: "Puck",
    });

    expect(kokoroMock).not.toHaveBeenCalled();
    expect(geminiMock).toHaveBeenCalledTimes(1);
  });
});
