import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/lib/wallet/reader-wallet-fixture-page", () => ({
  isReaderWalletFixturePageEnabled: vi.fn(),
}));

describe("PostThemeFixturePage gate", () => {
  afterEach(() => {
    vi.resetModules();
    notFound.mockReset();
  });

  it("calls notFound when fixture gate is disabled", async () => {
    const { isReaderWalletFixturePageEnabled } = await import(
      "@/lib/wallet/reader-wallet-fixture-page"
    );
    vi.mocked(isReaderWalletFixturePageEnabled).mockReturnValue(false);
    const Page = (await import("./page")).default;
    Page();
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("does not call notFound when fixture gate is enabled", async () => {
    const { isReaderWalletFixturePageEnabled } = await import(
      "@/lib/wallet/reader-wallet-fixture-page"
    );
    vi.mocked(isReaderWalletFixturePageEnabled).mockReturnValue(true);
    const Page = (await import("./page")).default;
    Page();
    expect(notFound).not.toHaveBeenCalled();
  });
});
