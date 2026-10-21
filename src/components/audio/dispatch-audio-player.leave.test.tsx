// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DispatchAudioPlayer } from "./dispatch-audio-player";

const pathnameState = vi.hoisted(() => ({ value: "/posts/demo" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

describe("DispatchAudioPlayer navigation teardown", () => {
  const speakMock = vi.fn();
  let playImpl: () => Promise<void>;

  beforeEach(() => {
    pathnameState.value = "/posts/demo";
    playImpl = () => Promise.reject(new Error("play interrupted"));

    speakMock.mockClear();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: speakMock,
        pause: vi.fn(),
        resume: vi.fn(),
        paused: false,
        getVoices: () => [],
      },
    });

    vi.stubGlobal(
      "Audio",
      class MockAudio {
        playbackRate = 1;
        currentTime = 0;
        duration = 120;
        ended = false;
        onloadedmetadata: (() => void) | null = null;
        ontimeupdate: (() => void) | null = null;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "https://example.com/narration.mp3";
        play = vi.fn(() => {
          window.dispatchEvent(new Event("pagehide"));
          return playImpl();
        });
        pause = vi.fn();
        removeAttribute = vi.fn();
        load = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not start speechSynthesis when play() rejects after pagehide", async () => {
    render(
      <DispatchAudioPlayer
        slug="demo"
        title="Demo post"
        audioUrl="https://example.com/narration.mp3"
        listenMinutes={2}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /play audio narration/i }),
    );

    await waitFor(() => {
      expect(speakMock).not.toHaveBeenCalled();
    });
  });
});
