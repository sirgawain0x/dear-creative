/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { WalletSendForm } from "./wallet-send-form";
import type { WalletSendPort } from "./wallet-send-types";

const RECIPIENT = getAddress("0x2222222222222222222222222222222222222222");
const FROM = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

function mockPort(overrides?: Partial<WalletSendPort>): WalletSendPort {
  return {
    estimateSend: vi.fn(async () => ({
      recipient: RECIPIENT,
      amount: "1.25",
      asset: "USDC" as const,
      warnings: [],
      chain: { network: "base", chainId: 8453 },
      gas: { estimatedEth: "0.0001", sponsoredByPaymaster: true },
    })),
    executeSend: vi.fn(async () => ({
      ok: true as const,
      txHash:
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    })),
    ...overrides,
  };
}

describe("WalletSendForm", () => {
  it("renders nothing when disabled", () => {
    const { container } = render(
      <WalletSendForm
        enabled={false}
        wallet={{ address: FROM, chain: { network: "base", chainId: 8453 } }}
        sendPort={mockPort()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("uses injected send port for estimate and execute", async () => {
    const sendPort = mockPort();
    render(
      <WalletSendForm
        enabled
        wallet={{
          address: FROM,
          chain: { network: "base", chainId: 8453 },
          balances: { eth: { formatted: "1" }, usdc: { formatted: "5" } },
        }}
        sendPort={sendPort}
      />,
    );

    fireEvent.click(screen.getByTestId("wallet-send-open"));
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^recipient$/i), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText(/^amount$/i), {
        target: { value: "1.25" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review send/i }));
    });

    expect(sendPort.estimateSend).toHaveBeenCalled();
    expect(await screen.findByTestId("wallet-send-confirm")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm send/i }));
    });

    expect(sendPort.executeSend).toHaveBeenCalled();
    expect(await screen.findByTestId("wallet-send-success")).toBeInTheDocument();
  });
});
