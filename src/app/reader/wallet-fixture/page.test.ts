import { beforeEach, describe, expect, it, vi } from "vitest";

const isReaderWalletFixturePageEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wallet/reader-wallet-fixture-page", () => ({
  isReaderWalletFixturePageEnabled: isReaderWalletFixturePageEnabledMock,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

describe("/reader/wallet-fixture page gate", () => {
  beforeEach(() => {
    isReaderWalletFixturePageEnabledMock.mockReset();
  });

  it("returns 404 when fixture gate is off", async () => {
    isReaderWalletFixturePageEnabledMock.mockReturnValue(false);
    const { default: Page } = await import("./page");
    expect(() => Page({})).toThrow("NOT_FOUND");
  });

  it("renders when fixture gate is on", async () => {
    isReaderWalletFixturePageEnabledMock.mockReturnValue(true);
    const { default: Page } = await import("./page");
    expect(Page({})).toBeTruthy();
  });
});
