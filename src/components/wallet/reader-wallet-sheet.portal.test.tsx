/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderWalletSheet } from "./reader-wallet-sheet";

vi.mock("./reader-wallet-panel", () => ({
  ReaderWalletPanel: () => <div data-testid="reader-wallet-panel-mock">Panel</div>,
}));

describe("ReaderWalletSheet portal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the overlay on document.body, not inside a backdrop-blur header", () => {
    render(
      <header className="sticky top-0 backdrop-blur">
        <ReaderWalletSheet open onOpenChange={() => {}} />
      </header>,
    );

    const overlay = screen.getByTestId("reader-wallet-sheet-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(
      document.querySelector("header")?.contains(overlay),
    ).toBe(false);
  });
});
