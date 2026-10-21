/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("@/lib/subscribers/get-public-active-subscriber-count", () => ({
  getPublicActiveSubscriberCount: vi.fn(),
}));

const { getPublicActiveSubscriberCount } = await import(
  "@/lib/subscribers/get-public-active-subscriber-count"
);

describe("ActiveSubscriberLine", () => {
  it("renders nothing when count is unavailable", async () => {
    vi.mocked(getPublicActiveSubscriberCount).mockResolvedValue(null);
    const { ActiveSubscriberLine } = await import("./active-subscriber-line");
    const view = await ActiveSubscriberLine();
    const { container } = render(view);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the formatted count without PII", async () => {
    vi.mocked(getPublicActiveSubscriberCount).mockResolvedValue(1284);
    const { ActiveSubscriberLine } = await import("./active-subscriber-line");
    const view = await ActiveSubscriberLine();
    render(view);

    expect(
      screen.getByText("Join 1,284 creatives reading Dear Creative"),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@/);
    expect(document.body.textContent).toMatch(/\d/);
  });
});
