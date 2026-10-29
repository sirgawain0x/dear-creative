/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CreativePlatformAppsDrawer } from "./creative-platform-apps-drawer";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderDrawer() {
  return render(
    <ThemeProvider>
      <CreativePlatformAppsDrawer />
    </ThemeProvider>,
  );
}

describe("CreativePlatformAppsDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes the grid trigger with an accessible name", () => {
    renderDrawer();
    expect(
      screen.getByRole("button", { name: "Browse Creative Platform apps" }),
    ).toBeInTheDocument();
  });
});
