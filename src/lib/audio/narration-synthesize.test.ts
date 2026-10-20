import { afterEach, describe, expect, it, vi } from "vitest";
import * as narrationDeadline from "./narration-deadline";
import {
  GEMINI_NARRATION_FALLBACK_VOICE,
  synthesizeNarrationChunks,
} from "./narration-synthesize";

const kokoroMock = vi.hoisted(() => vi.fn());
const geminiMock = vi.hoisted(() => vi.fn());

vi.mock("./kokoro-server-tts", () => ({
  synthesizeSpeechWithKokoroServer: kokoroMock,
  isKokoroServerConfigured: () => true,
}));

vi.mock("@/lib/adam/gemini-studio", () => ({
  synthesizeSpeechWithGoogle: geminiMock,
}));

describe("synthesizeNarrationChunks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    kokoroMock.mockReset();
    geminiMock.mockReset();
  });

  it("uses Kokoro for every chunk when provider is kokoro", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    kokoroMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "kokoro-cloud-run",
    });

    const result = await synthesizeNarrationChunks({
      chunks: ["One.", "Two."],
      voiceName: "af_heart",
    });

    expect(kokoroMock).toHaveBeenCalledTimes(2);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("kokoro-cloud-run");
    expect(result.parts).toHaveLength(2);
  });

  it("regenerates the entire article with Gemini (Puck) when Kokoro fails", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "true");
    kokoroMock.mockRejectedValueOnce(new Error("503"));
    geminiMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "gemini",
    });

    const result = await synthesizeNarrationChunks({
      chunks: ["Alpha.", "Beta."],
      voiceName: "af_heart",
    });

    expect(kokoroMock).toHaveBeenCalledTimes(1);
    expect(geminiMock).toHaveBeenCalledTimes(2);
    expect(geminiMock.mock.calls[0]?.[0]?.voiceName).toBe(
      GEMINI_NARRATION_FALLBACK_VOICE,
    );
    expect(result.provider).toContain("kokoro-fallback");
  });

  it("builds a fresh abort signal per chunk from the narration deadline", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    const buildSpy = vi.spyOn(narrationDeadline, "buildNarrationFetchSignal");
    buildSpy.mockReturnValue(new AbortController().signal);
    kokoroMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "kokoro-cloud-run",
    });

    const deadlineAtMs = Date.now() + 60_000;
    await synthesizeNarrationChunks({
      chunks: ["One.", "Two.", "Three."],
      voiceName: "af_heart",
      deadlineAtMs,
    });

    expect(buildSpy).toHaveBeenCalledTimes(3);
    expect(kokoroMock).toHaveBeenCalledTimes(3);
    for (const call of kokoroMock.mock.calls) {
      expect(call[0]?.signal).toBeDefined();
    }
    buildSpy.mockRestore();
  });

  it("skips Gemini fallback when the wall budget is too small", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "true");
    kokoroMock.mockRejectedValueOnce(new Error("503"));

    await expect(
      synthesizeNarrationChunks({
        chunks: ["Only kokoro."],
        voiceName: "af_heart",
        deadlineAtMs: Date.now() + 1_000,
      }),
    ).rejects.toThrow("503");

    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("passes abort signal into Gemini when falling back", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "true");
    kokoroMock.mockRejectedValueOnce(new Error("503"));
    geminiMock.mockResolvedValue({
      audioBase64: "aGk=",
      mimeType: "audio/wav",
      provider: "gemini",
    });

    await synthesizeNarrationChunks({
      chunks: ["Alpha."],
      voiceName: "af_heart",
      deadlineAtMs: Date.now() + 120_000,
    });

    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(geminiMock.mock.calls[0]?.[0]?.signal).toBeDefined();
  });

  it("does not call Gemini when Kokoro fails and fallback is disabled", async () => {
    vi.stubEnv("NARRATION_PROVIDER", "kokoro");
    vi.stubEnv("NARRATION_GEMINI_FALLBACK", "false");
    kokoroMock.mockRejectedValue(new Error("503"));

    await expect(
      synthesizeNarrationChunks({
        chunks: ["Only kokoro."],
        voiceName: "af_heart",
      }),
    ).rejects.toThrow("503");

    expect(geminiMock).not.toHaveBeenCalled();
  });
});
