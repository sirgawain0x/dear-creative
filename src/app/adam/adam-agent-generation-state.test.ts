import { describe, expect, it } from "vitest";
import {
  adamChatAriaBusy,
  adamChatLiveStatusLabel,
  isAdamChatBusy,
} from "./adam-agent-generation-state";

describe("adam agent generation state", () => {
  it("idle is not busy", () => {
    expect(isAdamChatBusy("idle")).toBe(false);
    expect(adamChatAriaBusy("idle")).toBe(false);
    expect(adamChatLiveStatusLabel("idle")).toBeNull();
  });

  it("waiting and streaming are busy with live labels", () => {
    expect(isAdamChatBusy("waiting")).toBe(true);
    expect(isAdamChatBusy("streaming")).toBe(true);
    expect(adamChatLiveStatusLabel("waiting")).toBe("Adam is thinking");
    expect(adamChatLiveStatusLabel("streaming")).toBe("Adam is responding");
  });

  it("done is not busy", () => {
    expect(isAdamChatBusy("done")).toBe(false);
    expect(adamChatLiveStatusLabel("done")).toBeNull();
  });

  it("error exposes an accessible label then clears in UI flow", () => {
    expect(isAdamChatBusy("error")).toBe(false);
    expect(adamChatLiveStatusLabel("error")).toBe(
      "Adam could not finish the response",
    );
  });
});
