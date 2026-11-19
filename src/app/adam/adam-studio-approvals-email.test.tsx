/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppProviders,
  STUDIO_TOKEN_STORAGE_KEY,
} from "@/components/providers/app-providers";
import type { ApprovalQueueItem } from "@/lib/approval/list-queue";
import { AdamStudio } from "./adam-studio";

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
  usePathname: () => "/approvals",
  useSearchParams: () => new URLSearchParams(),
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

function makeItem(
  overrides: Partial<ApprovalQueueItem> = {},
): ApprovalQueueItem {
  return {
    postId: "post-1",
    slug: "issue-one",
    title: "Issue One",
    status: "approved",
    postStatus: "published",
    teaserText: "A short teaser",
    emailSubject: "Issue One Subject",
    emailHtml: "<p>Hello</p>",
    bodyHtml: "<p>Hello</p>",
    contentHash: "hash-1",
    createdAt: "2026-11-19T12:00:00.000Z",
    emailDeliveryStatus: null,
    emailDeliveredAt: null,
    emailDeliveryError: null,
    ...overrides,
  };
}

function renderApprovalsStudio() {
  localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, "fixture-studio-key");
  return render(
    <AppProviders>
      <AdamStudio initialTab="approvals" />
    </AppProviders>,
  );
}

describe("AdamStudio Approval Queue email delivery UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
  });

  it("shows Send Newsletter button for approved unsent post and transitions to Email Sent after sending", async () => {
    let sent = false;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/api/admin/config")) {
          return new Response(
            JSON.stringify({ privyConfigured: true, adamTokenConfigured: true }),
            { status: 200 },
          );
        }
        if (url.includes("/api/admin/me")) {
          return new Response(
            JSON.stringify({ userId: "admin-1", isAdmin: true }),
            { status: 200 },
          );
        }
        if (url.includes("/api/adam/deliver/email")) {
          expect(init?.method).toBe("POST");
          sent = true;
          return new Response(
            JSON.stringify({
              outcome: "sent",
              broadcastId: "b-1",
              dryRun: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/api/approvals")) {
          return new Response(
            JSON.stringify({
              approvals: [
                makeItem({
                  emailDeliveryStatus: sent ? "completed" : null,
                  emailDeliveredAt: sent
                    ? "2026-11-19T12:05:00.000Z"
                    : null,
                }),
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

    renderApprovalsStudio();

    const sendButton = await screen.findByRole("button", {
      name: "Send Newsletter",
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText("Email Sent")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Send Newsletter" }),
    ).not.toBeInTheDocument();
    expect(
      fetchSpy.mock.calls.some(([u]) =>
        String(u).includes("/api/adam/deliver/email"),
      ),
    ).toBe(true);
  });

  it("shows Email Sent badge and hides Send Newsletter for already-emailed posts", async () => {
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
          JSON.stringify({ userId: "admin-1", isAdmin: true }),
          { status: 200 },
        );
      }
      if (url.includes("/api/approvals")) {
        return new Response(
          JSON.stringify({
            approvals: [
              makeItem({
                emailDeliveryStatus: "completed",
                emailDeliveredAt: "2026-11-19T12:05:00.000Z",
              }),
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApprovalsStudio();

    expect(await screen.findByText("Email Sent")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Send Newsletter|Retry Newsletter/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Email Failed badge, error text, and Retry Newsletter button when email failed", async () => {
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
          JSON.stringify({ userId: "admin-1", isAdmin: true }),
          { status: 200 },
        );
      }
      if (url.includes("/api/approvals")) {
        return new Response(
          JSON.stringify({
            approvals: [
              makeItem({
                emailDeliveryStatus: "failed",
                emailDeliveryError: "Resend rate limit exceeded",
              }),
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApprovalsStudio();

    expect(await screen.findByText("Email Failed")).toBeInTheDocument();
    expect(
      screen.getByText(/Email error: Resend rate limit exceeded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry Newsletter" }),
    ).toBeInTheDocument();
  });

  it("displays email delivery feedback banner when clicking Approve & Publish", async () => {
    let approved = false;
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
          JSON.stringify({ userId: "admin-1", isAdmin: true }),
          { status: 200 },
        );
      }
      if (url.includes("/api/approvals/post-pending/approve")) {
        approved = true;
        return new Response(
          JSON.stringify({
            outcome: "approved",
            postId: "post-pending",
            emailDelivery: {
              outcome: "sent",
              broadcastId: "b-approve",
              dryRun: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/approvals")) {
        return new Response(
          JSON.stringify({
            approvals: [
              makeItem({
                postId: "post-pending",
                slug: "pending-issue",
                title: "Pending Issue",
                status: approved ? "approved" : "pending",
                postStatus: approved ? "published" : "draft",
                emailDeliveryStatus: approved ? "completed" : null,
              }),
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApprovalsStudio();

    const approveBtn = await screen.findByRole("button", {
      name: "Approve & Publish",
    });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /Post approved, published, and newsletter email sent!/i,
        ).length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText("Email Sent")).toBeInTheDocument();
  });
});
