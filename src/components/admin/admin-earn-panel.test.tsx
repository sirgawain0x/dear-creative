/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioTokenProvider } from "@/components/providers/app-providers";
import { AdminEarnPanel } from "./admin-earn-panel";
import {
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
} from "@/lib/earn/vaults";

vi.mock("@privy-io/react-auth", () => ({
  useWallets: () => ({ wallets: [] }),
  useAuthorizationSignature: () => ({
    generateAuthorizationSignature: vi.fn(),
  }),
}));

const previewData = {
  vaults: [
    {
      id: EARN_VAULT_AAVE_ID,
      name: "Aave USDC",
      provider: "aave" as const,
      vault_address: "0x1234567890123456789012345678901234567890",
      asset: { address: "0x1", symbol: "usdc", decimals: 6 },
      caip2: "eip155:8453",
      user_apy: 420,
      app_apy: 80,
      tvl_usd: 1000,
      available_liquidity_usd: 500,
      admin_wallet_id: "w",
      admin_wallet_address: "0x2",
    },
    {
      id: EARN_VAULT_MORPHO_ID,
      name: "Morpho Vault",
      provider: "morpho" as const,
      vault_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      asset: { address: "0x3", symbol: "usdc", decimals: 6 },
      caip2: "eip155:8453",
      user_apy: 500,
      app_apy: 100,
      tvl_usd: 2000,
      available_liquidity_usd: 800,
      admin_wallet_id: "w",
      admin_wallet_address: "0x4",
    },
  ],
  positions: {
    [EARN_VAULT_AAVE_ID]: {
      configured: true as const,
      vaultId: EARN_VAULT_AAVE_ID,
      position: {
        asset: { symbol: "usdc", decimals: 6 },
        total_deposited: "1000000000",
        total_withdrawn: "200000000",
        assets_in_vault: "850000000",
      },
    },
  },
};

const mockUseAuthSession = vi.fn();

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useAuthSession: () => mockUseAuthSession(),
  };
});

function defaultSignedInSession() {
  return {
    ready: true,
    isSignedIn: true,
    authenticated: true,
    getAccessToken: vi.fn(async () => "privy-access-token"),
    privyConfigured: true,
    privyTimedOut: false,
    hasStudioToken: false,
    user: { id: "did:privy:admin" },
    login: vi.fn(),
    signOut: vi.fn(),
  };
}

function renderEarnPanel(ui: ReactElement) {
  return render(<StudioTokenProvider>{ui}</StudioTokenProvider>);
}

describe("AdminEarnPanel fetch errors", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReturnValue(defaultSignedInSession());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows Sign in with Privy when vaults API returns 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    await act(async () => {
      renderEarnPanel(<AdminEarnPanel earnEnabled />);
    });

    await waitFor(() => {
      expect(screen.getByText("Sign in with Privy")).toBeInTheDocument();
    });
  });

  it("shows Admin access required when vaults API returns 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    await act(async () => {
      renderEarnPanel(<AdminEarnPanel earnEnabled />);
    });

    await waitFor(() => {
      expect(screen.getByText("Admin access required.")).toBeInTheDocument();
    });
  });

  it("shows disabled message when vaults API returns 404 with an empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );

    await act(async () => {
      renderEarnPanel(<AdminEarnPanel earnEnabled />);
    });

    await waitFor(() => {
      expect(screen.getByText("Earn feature is disabled.")).toBeInTheDocument();
    });
  });

  it("shows API error code when vaults API returns a non-empty error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "earn_vault_not_found" }), {
        status: 502,
      }),
    );

    await act(async () => {
      renderEarnPanel(<AdminEarnPanel earnEnabled />);
    });

    await waitFor(() => {
      expect(screen.getByText("earn_vault_not_found")).toBeInTheDocument();
    });
  });
});

describe("AdminEarnPanel", () => {
  it("renders vault metrics and yield from preview data", () => {
    renderEarnPanel(<AdminEarnPanel earnEnabled previewData={previewData} />);
    expect(screen.getByText("4.2%")).toBeInTheDocument();
    expect(screen.getByText("850 USDC")).toBeInTheDocument();
    expect(screen.getByText("50 USDC")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /0x1234567890123456789012345678901234567890/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://basescan.org/address/0x1234567890123456789012345678901234567890",
    );
  });

  it("shows disabled message when earn flag is off", () => {
    renderEarnPanel(<AdminEarnPanel earnEnabled={false} />);
    expect(screen.getByText(/EARN_ENABLED=true/i)).toBeInTheDocument();
  });

  it("uses fixture preview wallet for earn actions (not vault admin_wallet_*)", () => {
    renderEarnPanel(
      <AdminEarnPanel
        earnEnabled
        earnActionsEnabled
        earnActionsWalletPreview={{
          walletId: "fixture-user-wallet",
          walletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
        }}
        previewData={previewData}
      />,
    );
    expect(screen.getByText(/Deposit \/ withdraw/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Signed in your browser via Privy/i),
    ).toBeInTheDocument();
  });
});
