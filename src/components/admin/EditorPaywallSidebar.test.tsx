// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PAYWALL_SETTINGS } from "@/lib/posts/paywall-editor-defaults";
import { EditorPaywallSidebar } from "./EditorPaywallSidebar";

describe("EditorPaywallSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Free/Paid access choice and hides content fields on Free", () => {
    render(
      <EditorPaywallSidebar
        settings={DEFAULT_PAYWALL_SETTINGS}
        onChange={vi.fn()}
        onInsertGateTag={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "Free" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByLabelText(/free_content/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gated_content/i)).not.toBeInTheDocument();
  });

  it("calls onChange with isGated when Paid is selected", () => {
    const onChange = vi.fn();
    render(
      <EditorPaywallSidebar
        settings={DEFAULT_PAYWALL_SETTINGS}
        onChange={onChange}
        onInsertGateTag={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Paid" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ isGated: true }),
    );
  });

  it("shows free_content and gated_content fields when Paid", () => {
    render(
      <EditorPaywallSidebar
        settings={{ ...DEFAULT_PAYWALL_SETTINGS, isGated: true }}
        onChange={vi.fn()}
        onInsertGateTag={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/free_content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gated_content/i)).toBeInTheDocument();
  });
});
