import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => undefined));
const isReaderWalletFixturePageEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/wallet/reader-wallet-fixture-page", () => ({
  isReaderWalletFixturePageEnabled: isReaderWalletFixturePageEnabledMock,
}));

describe("/reader/wallet-fixture page gate", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    isReaderWalletFixturePageEnabledMock.mockReset();
  });

  it("calls notFound when fixture gate is off", async () => {
    isReaderWalletFixturePageEnabledMock.mockReturnValue(false);
    const { default: Page } = await import("./page");
    Page();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("does not call notFound when fixture gate is on", async () => {
    isReaderWalletFixturePageEnabledMock.mockReturnValue(true);
    const { default: Page } = await import("./page");
    Page();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
