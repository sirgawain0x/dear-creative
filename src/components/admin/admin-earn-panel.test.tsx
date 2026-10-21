/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { StudioTokenProvider } from "@/components/providers/app-providers";
import { AdminEarnPanel } from "./admin-earn-panel";
import {
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
} from "@/lib/earn/vaults";

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

function renderEarnPanel(ui: ReactElement) {
  return render(<StudioTokenProvider>{ui}</StudioTokenProvider>);
}

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
});
