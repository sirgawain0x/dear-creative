import { describe, expect, it } from "vitest";
import {
  SEEK_KEYBOARD_STEP_SEC,
  SEEK_SKIP_SECONDS,
  clampSeekTime,
  keyboardSeekTime,
  seekRatioFromClientX,
  seekTimeFromClientX,
  shouldShowStoredAudioSeekControls,
} from "./dispatch-audio-player-seek";

describe("clampSeekTime", () => {
  it("adds delta within duration", () => {
    expect(clampSeekTime(30, 10, 120)).toBe(40);
    expect(clampSeekTime(30, -10, 120)).toBe(20);
  });

  it("clamps to 0 and duration", () => {
    expect(clampSeekTime(5, -SEEK_SKIP_SECONDS, 120)).toBe(0);
    expect(clampSeekTime(115, SEEK_SKIP_SECONDS, 120)).toBe(120);
    expect(clampSeekTime(0, -5, 0)).toBe(0);
  });
});

describe("seekTimeFromClientX", () => {
  it("maps pointer position to time", () => {
    const rect = { left: 100, width: 200 };
    expect(seekTimeFromClientX(100, rect, 60)).toBe(0);
    expect(seekTimeFromClientX(200, rect, 60)).toBe(30);
    expect(seekTimeFromClientX(300, rect, 60)).toBe(60);
  });

  it("clamps ratio outside the bar", () => {
    const rect = { left: 0, width: 100 };
    expect(seekRatioFromClientX(-10, rect)).toBe(0);
    expect(seekRatioFromClientX(150, rect)).toBe(1);
  });
});

describe("keyboardSeekTime", () => {
  const duration = 100;

  it("steps by keyboard increment", () => {
    expect(keyboardSeekTime(50, duration, "ArrowLeft")).toBe(
      50 - SEEK_KEYBOARD_STEP_SEC,
    );
    expect(keyboardSeekTime(50, duration, "ArrowRight")).toBe(
      50 + SEEK_KEYBOARD_STEP_SEC,
    );
  });

  it("clamps arrow keys at bounds", () => {
    expect(keyboardSeekTime(2, duration, "ArrowLeft")).toBe(0);
    expect(keyboardSeekTime(98, duration, "ArrowRight")).toBe(100);
  });

  it("jumps to start and end", () => {
    expect(keyboardSeekTime(40, duration, "Home")).toBe(0);
    expect(keyboardSeekTime(40, duration, "End")).toBe(100);
  });

  it("returns null when duration is zero", () => {
    expect(keyboardSeekTime(0, 0, "ArrowRight")).toBeNull();
  });
});

describe("shouldShowStoredAudioSeekControls", () => {
  it("shows controls for stored MP3 mode", () => {
    expect(
      shouldShowStoredAudioSeekControls({
        hasStaticAudioSrc: true,
        useBrowserSpeech: false,
      }),
    ).toBe(true);
  });

  it("hides controls for speechSynthesis fallback", () => {
    expect(
      shouldShowStoredAudioSeekControls({
        hasStaticAudioSrc: true,
        useBrowserSpeech: true,
      }),
    ).toBe(false);
  });

  it("hides controls when there is no stored audio", () => {
    expect(
      shouldShowStoredAudioSeekControls({
        hasStaticAudioSrc: false,
        useBrowserSpeech: true,
      }),
    ).toBe(false);
  });
});
