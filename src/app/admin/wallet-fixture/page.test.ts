import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => undefined));
const isAdminWalletFixturePageEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/wallet/admin-wallet-fixture-page", () => ({
  isAdminWalletFixturePageEnabled: isAdminWalletFixturePageEnabledMock,
}));

vi.mock("./wallet-fixture-client", () => ({
  WalletFixtureClient: () => null,
}));

describe("AdminWalletFixturePage", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    isAdminWalletFixturePageEnabledMock.mockReset();
  });

  it("calls notFound when the fixture page gate is off (e.g. production)", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(false);
    const { default: AdminWalletFixturePage } = await import("./page");
    AdminWalletFixturePage();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("does not call notFound when the fixture page gate is on", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(true);
    const { default: AdminWalletFixturePage } = await import("./page");
    AdminWalletFixturePage();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
