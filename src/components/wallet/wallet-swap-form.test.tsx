/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletSwapForm } from "./wallet-swap-form";
import type { WalletSwapPort } from "./wallet-swap-types";

const ADMIN = "0xAE48B6dB64772b9CC24e33A79c809896776a20f6";

function mockPort(overrides?: Partial<WalletSwapPort>): WalletSwapPort {
  return {
    requestQuote: vi.fn(async () => ({
      from: ADMIN,
      direction: "USDC_TO_ETH" as const,
      amount: "10",
      slippageBps: 50,
      chainId: 8453,
      needsWalletUpgrade: true,
      quoteSeal: "preview-seal",
      quote: {
        expiry: new Date(Date.now() + 120_000).toISOString(),
        minimumToAmount: "0x5f5e100",
        fromAmount: "0x5f5e100",
      },
      prepared: { type: "user-operation-v070" },
    })),
    submitSwap: vi.fn(async () => ({ callId: "call-1" })),
    pollStatus: vi.fn(async () => ({ status: 200, txHash: "0xabc" })),
    ...overrides,
  };
}

describe("WalletSwapForm", () => {
  it("shows one-time wallet upgrade on confirm", async () => {
    const port = mockPort();
    render(
      <WalletSwapForm
        enabled
        adminAddress={ADMIN}
        swapPort={port}
        signPreparedSwap={async () => ({
          signature: "0x11",
          authorizations: [],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("wallet-swap-open"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /review swap/i }));
    });
    expect(await screen.findByTestId("wallet-swap-confirm")).toBeInTheDocument();
    expect(screen.getByText(/one-time wallet upgrade/i)).toBeInTheDocument();
  });

});
