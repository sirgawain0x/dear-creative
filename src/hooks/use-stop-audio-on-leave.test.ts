// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stopDispatchAudioResources } from "@/lib/audio/stop-active-audio";
import { useStopAudioOnLeave } from "./use-stop-audio-on-leave";

function createStopSpy() {
  const mockAudio = {
    onloadedmetadata: null,
    ontimeupdate: null,
    onended: null,
    onerror: null,
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  const mockSpeechSynthesis = { cancel: vi.fn() };
  const stop = () => {
    stopDispatchAudioResources({
      audio: mockAudio as unknown as HTMLAudioElement,
      utterance: null,
      abortController: null,
      speechSynthesis: mockSpeechSynthesis,
    });
  };
  return { stop, mockAudio, mockSpeechSynthesis };
}

const pathnameState = vi.hoisted(() => ({ value: "/adam" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

describe("useStopAudioOnLeave", () => {
  afterEach(() => {
    pathnameState.value = "/adam";
    vi.clearAllMocks();
  });

  it("does not call stop on initial mount", () => {
    const stop = vi.fn();
    renderHook(() => useStopAudioOnLeave(stop));
    expect(stop).not.toHaveBeenCalled();
  });

  it("calls stop on unmount and tears down audio + speech synthesis", () => {
    const { stop, mockAudio, mockSpeechSynthesis } = createStopSpy();
    const { unmount } = renderHook(() => useStopAudioOnLeave(stop));

    unmount();
    expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it("calls stop when pathname changes and tears down audio + speech synthesis", () => {
    const { stop, mockAudio, mockSpeechSynthesis } = createStopSpy();
    const { rerender } = renderHook(() => useStopAudioOnLeave(stop));

    mockAudio.pause.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
    pathnameState.value = "/posts/hello";
    rerender();

    expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it("calls stop on window pagehide and tears down audio + speech synthesis", () => {
    const { stop, mockAudio, mockSpeechSynthesis } = createStopSpy();
    renderHook(() => useStopAudioOnLeave(stop));

    mockAudio.pause.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
    window.dispatchEvent(new Event("pagehide"));

    expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });
});
