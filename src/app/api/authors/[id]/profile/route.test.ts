import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/authors/feature-flag", () => ({
  isAuthorProfilesEnabled: vi.fn(() => true),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/authors/author-access", () => ({
  requireAuthorProfileEditAccess: vi.fn(),
}));

vi.mock("@/lib/authors/author-profile", () => ({
  getAuthorProfileById: vi.fn(),
  updateAuthorDisplayProfile: vi.fn(),
}));

import { requireAuthorProfileEditAccess } from "@/lib/authors/author-access";
import {
  getAuthorProfileById,
  updateAuthorDisplayProfile,
} from "@/lib/authors/author-profile";
import { PATCH } from "./route";

describe("PATCH /api/authors/[id]/profile", () => {
  beforeEach(() => {
    vi.mocked(requireAuthorProfileEditAccess).mockReset();
    vi.mocked(getAuthorProfileById).mockReset();
    vi.mocked(updateAuthorDisplayProfile).mockReset();
  });

  it("rejects taglines over 120 characters", async () => {
    vi.mocked(requireAuthorProfileEditAccess).mockResolvedValue({
      ok: true,
      privyUserId: "did:privy:admin",
      isAdmin: true,
    });
    vi.mocked(getAuthorProfileById).mockResolvedValue({
      id: "g2",
      name: "G2",
      slug: "g2",
      bio: null,
      tagline: null,
      avatarUrl: null,
    });
    vi.mocked(updateAuthorDisplayProfile).mockResolvedValue({
      ok: false,
      error: "Tagline is too long",
    });

    const response = await PATCH(
      new Request("http://localhost/api/authors/g2/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagline: "x".repeat(121) }),
      }),
      { params: Promise.resolve({ id: "g2" }) },
    );

    expect(response.status).toBe(400);
    expect(requireAuthorProfileEditAccess).toHaveBeenCalledWith(
      expect.any(Request),
      "g2",
    );
  });

  it("returns auth errors from requireAuthorProfileEditAccess", async () => {
    vi.mocked(requireAuthorProfileEditAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/authors/g2/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "G2" }),
      }),
      { params: Promise.resolve({ id: "g2" }) },
    );

    expect(response.status).toBe(403);
    expect(updateAuthorDisplayProfile).not.toHaveBeenCalled();
  });
});
