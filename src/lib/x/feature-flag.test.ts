import { afterEach, describe, expect, it } from "vitest";
import { isXLiveEnabled, setXLiveEnabledForTests } from "./feature-flag";

describe("isXLiveEnabled", () => {
  afterEach(() => {
    setXLiveEnabledForTests(undefined);
    delete process.env.X_LIVE;
  });

  it("is false when unset", () => {
    delete process.env.X_LIVE;
    expect(isXLiveEnabled()).toBe(false);
  });

  it("is true only for the exact string true", () => {
    process.env.X_LIVE = "true";
    expect(isXLiveEnabled()).toBe(true);
  });

  it("rejects TRUE", () => {
    process.env.X_LIVE = "TRUE";
    expect(isXLiveEnabled()).toBe(false);
  });

  it("rejects leading or trailing whitespace", () => {
    process.env.X_LIVE = " true";
    expect(isXLiveEnabled()).toBe(false);
    process.env.X_LIVE = "true ";
    expect(isXLiveEnabled()).toBe(false);
  });

  it("rejects 1 and other truthy strings", () => {
    process.env.X_LIVE = "1";
    expect(isXLiveEnabled()).toBe(false);
    process.env.X_LIVE = "yes";
    expect(isXLiveEnabled()).toBe(false);
  });

  it("respects test override", () => {
    process.env.X_LIVE = "false";
    setXLiveEnabledForTests(true);
    expect(isXLiveEnabled()).toBe(true);
  });
});
