import { afterEach, describe, expect, it, vi } from "vitest";
import { setAuthorProfilesEnabledForTests } from "./feature-flag";

const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("NOT_FOUND");
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("ensureAuthorProfilesEnabled", () => {
  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    notFoundMock.mockClear();
  });

  it("calls notFound when the flag is off", async () => {
    setAuthorProfilesEnabledForTests(false);
    const { ensureAuthorProfilesEnabled } = await import("./guard");
    expect(() => ensureAuthorProfilesEnabled()).toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("allows render when the flag is on", async () => {
    setAuthorProfilesEnabledForTests(true);
    const { ensureAuthorProfilesEnabled } = await import("./guard");
    expect(() => ensureAuthorProfilesEnabled()).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
