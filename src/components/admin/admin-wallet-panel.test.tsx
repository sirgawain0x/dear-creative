/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";
import { AdminWalletPanel } from "./admin-wallet-panel";

const mockUseAuthSession = vi.fn();

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => mockUseAuthSession(),
  };
});

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,test"),
  },
}));

function mockBrowserStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
    },
  });
  return store;
}

describe("AdminWalletPanel admin fetch auth", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockBrowserStorage();
    store[STUDIO_TOKEN_STORAGE_KEY] = "studio-admin-key";
    mockUseAuthSession.mockReturnValue({
      ready: true,
      isSignedIn: true,
      authenticated: true,
      getAccessToken: vi.fn(async () => null),
      privyConfigured: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows transfer history error but keeps balances when history returns 502", async () => {
    mockUseAuthSession.mockReturnValue({
      ready: true,
      isSignedIn: true,
      authenticated: true,
      getAccessToken: vi.fn(async () => "privy-token"),
      privyConfigured: true,
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/wallet/history")) {
        return new Response(
          JSON.stringify({
            error: "transfer_history_unavailable",
            code: "http_error",
          }),
          { status: 502 },
        );
      }
      return new Response(
        JSON.stringify({
          configured: true,
          address: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
          balances: { eth: { formatted: "1.0" }, usdc: { formatted: "2.0" } },
        }),
        { status: 200 },
      );
    });

    await act(async () => {
      render(<AdminWalletPanel walletEnabled={true} />);
    });

    expect(await screen.findByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("Could not load transfer history.")).toBeInTheDocument();
    expect(
      screen.queryByText(/admin Privy session required/i),
    ).toBeNull();
  });

  it("uses studio bearer fallback like Payouts when Privy access token is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/admin/wallet/history")) {
        return new Response(
          JSON.stringify({ configured: true, transfers: [], pagination: {} }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          configured: true,
          address: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
          balances: { eth: { formatted: "0" }, usdc: { formatted: "0" } },
        }),
        { status: 200 },
      );
    });

    await act(async () => {
      render(<AdminWalletPanel walletEnabled={true} />);
    });

    await vi.waitFor(
      () => {
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 },
    );

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.headers).toEqual({
        Authorization: "Bearer studio-admin-key",
      });
    }
  });
});
