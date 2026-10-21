import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => undefined));
const isAdminWalletFixturePageEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/wallet/admin-wallet-fixture-page", () => ({
  isAdminWalletFixturePageEnabled: isAdminWalletFixturePageEnabledMock,
}));

vi.mock("./panels-layout-fixture-client", () => ({
  PanelsLayoutFixtureClient: () => null,
}));

describe("AdminPanelsLayoutFixturePage", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    isAdminWalletFixturePageEnabledMock.mockReset();
  });

  it("calls notFound when the fixture page gate is off (e.g. production)", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(false);
    const { default: AdminPanelsLayoutFixturePage } = await import("./page");
    AdminPanelsLayoutFixturePage();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("does not call notFound when the fixture page gate is on", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(true);
    const { default: AdminPanelsLayoutFixturePage } = await import("./page");
    AdminPanelsLayoutFixturePage();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
