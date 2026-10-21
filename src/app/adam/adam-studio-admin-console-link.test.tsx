/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdamStudio } from "./adam-studio";
import {
  AppProviders,
  STUDIO_TOKEN_STORAGE_KEY,
} from "@/components/providers/app-providers";

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

function mockStudioFetch(options: {
  meStatus?: number;
  isAdmin?: boolean;
}) {
  const { meStatus = 200, isAdmin = true } = options;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/admin/config")) {
      return new Response(
        JSON.stringify({ privyConfigured: true, adamTokenConfigured: true }),
        { status: 200 },
      );
    }
    if (url.includes("/api/admin/me")) {
      if (meStatus !== 200) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: meStatus,
        });
      }
      return new Response(
        JSON.stringify({ userId: "fixture-user", isAdmin }),
        { status: 200 },
      );
    }
    if (url.includes("/api/adam/")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

function renderStudioWithKey() {
  localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-studio-key");
  return render(
    <AppProviders>
      <AdamStudio />
    </AppProviders>,
  );
}

describe("AdamStudio Admin Console link", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
  });

  it("shows Admin Console link when /api/admin/me confirms admin", async () => {
    mockStudioFetch({ isAdmin: true });
    renderStudioWithKey();

    const link = await screen.findByTestId("studio-admin-console-link");
    expect(link).toHaveAttribute("href", "/admin");
    expect(link).toHaveTextContent("Admin Console");
  });

  it("hides Admin Console link for a non-admin user", async () => {
    mockStudioFetch({ isAdmin: false });
    renderStudioWithKey();

    await waitFor(() => {
      expect(screen.getByText(/Invalid Token \/ Admin Required/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("studio-admin-console-link")).not.toBeInTheDocument();
  });

  it("hides Admin Console link when /api/admin/me fails", async () => {
    mockStudioFetch({ meStatus: 401, isAdmin: false });
    renderStudioWithKey();

    await waitFor(() => {
      expect(screen.getByText(/Invalid Token \/ Admin Required/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("studio-admin-console-link")).not.toBeInTheDocument();
  });
});
