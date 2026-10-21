import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() => vi.fn(() => undefined));
const isAdminWalletFixturePageEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/wallet/admin-wallet-fixture-page", () => ({
  isAdminWalletFixturePageEnabled: isAdminWalletFixturePageEnabledMock,
}));

vi.mock("./swap-confirm/swap-confirm-fixture-client", () => ({
  AdminWalletSwapConfirmFixtureClient: () => null,
}));

vi.mock("./swap-pending/swap-pending-fixture-client", () => ({
  AdminWalletSwapPendingFixtureClient: () => null,
}));

vi.mock("./swap-success/swap-success-fixture-client", () => ({
  AdminWalletSwapSuccessFixtureClient: () => null,
}));

describe("admin wallet swap fixture pages", () => {
  afterEach(() => {
    notFoundMock.mockClear();
    isAdminWalletFixturePageEnabledMock.mockReset();
  });

  it("calls notFound when the fixture gate is off (production)", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(false);
    const { default: ConfirmPage } = await import("./swap-confirm/page");
    const { default: PendingPage } = await import("./swap-pending/page");
    const { default: SuccessPage } = await import("./swap-success/page");
    ConfirmPage();
    PendingPage();
    SuccessPage();
    expect(notFoundMock).toHaveBeenCalledTimes(3);
  });

  it("does not call notFound when the fixture gate is on", async () => {
    isAdminWalletFixturePageEnabledMock.mockReturnValue(true);
    const { default: ConfirmPage } = await import("./swap-confirm/page");
    ConfirmPage();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
