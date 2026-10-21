/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdamStudio } from "./adam-studio";
import { AppProviders, STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";
import { SiteHeader } from "@/components/site-header";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/adam",
}));

vi.mock("@/components/providers/app-providers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/app-providers")>();
  return {
    ...actual,
    useSafePrivy: () => ({
      ready: true,
      authenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn(async () => null),
      privyConfigured: true,
      adamTokenConfigured: true,
      configLoaded: true,
      privyTimedOut: false,
    }),
  };
});

function mockStudioFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/admin/config")) {
      return new Response(
        JSON.stringify({ privyConfigured: true, adamTokenConfigured: true }),
        { status: 200 },
      );
    }
    if (url.includes("/api/admin/me")) {
      return new Response(
        JSON.stringify({ userId: "fixture-user", isAdmin: true }),
        { status: 200 },
      );
    }
    if (url.includes("/api/adam/")) {
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/api/approvals")) {
      return new Response(JSON.stringify({ approvals: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

function renderAdamWithHeader() {
  return render(
    <AppProviders>
      <SiteHeader />
      <AdamStudio />
    </AppProviders>,
  );
}

describe("Studio Key session sync with header", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
  });

  it("updates header Sign Out after key entry and locks /adam after header sign out", async () => {
    mockStudioFetch();
    renderAdamWithHeader();

    expect(
      await screen.findByRole("heading", {
        name: /Sign In to Access Adam Studio/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Enter Studio Key/i }));
    fireEvent.change(screen.getByLabelText(/ADAM_API_TOKEN/i), {
      target: { value: "fixture-studio-key-sync" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save & Continue/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign Out" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("heading", {
        name: /Sign In to Access Adam Studio/i,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Sign In to Access Adam Studio/i,
        }),
      ).toBeInTheDocument();
    });

    expect(localStorage.getItem(STUDIO_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
