/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { AdminWalletSendForm } from "./admin-wallet-send-form";

const RECIPIENT = getAddress("0x2222222222222222222222222222222222222222");

describe("AdminWalletSendForm", () => {
  it("renders nothing when send flag is off", () => {
    const { container } = render(
      <AdminWalletSendForm
        walletAddress="0xAE48B6dB64772b9CC24e33A79c809896776a20f6"
        isAdmin={true}
        walletSendEnabled={false}
        getAccessToken={async () => "token"}
        privyConfigured={true}
        authenticated={true}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for non-admin", () => {
    const { container } = render(
      <AdminWalletSendForm
        walletAddress="0xAE48B6dB64772b9CC24e33A79c809896776a20f6"
        isAdmin={false}
        walletSendEnabled={true}
        getAccessToken={async () => "token"}
        privyConfigured={true}
        authenticated={true}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows confirm step in preview mode and blocks double confirm clicks", async () => {
    render(
      <AdminWalletSendForm
        walletAddress="0xAE48B6dB64772b9CC24e33A79c809896776a20f6"
        isAdmin={true}
        walletSendEnabled={true}
        getAccessToken={async () => "token"}
        privyConfigured={true}
        authenticated={true}
        previewMode
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

    expect(await screen.findByTestId("wallet-send-confirm")).toBeInTheDocument();
    expect(screen.getByText(RECIPIENT)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm send/i }));
    });

    expect(await screen.findByTestId("wallet-send-success")).toBeInTheDocument();
  });
});
