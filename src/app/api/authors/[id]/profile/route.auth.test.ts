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
import { getAuthorProfileById, updateAuthorDisplayProfile } from "@/lib/authors/author-profile";
import { PATCH } from "./route";

describe("PATCH /api/authors/[id]/profile auth wiring", () => {
  beforeEach(() => {
    vi.mocked(requireAuthorProfileEditAccess).mockReset();
    vi.mocked(getAuthorProfileById).mockReset();
    vi.mocked(updateAuthorDisplayProfile).mockReset();
  });

  it("passes author id into requireAuthorProfileEditAccess", async () => {
    vi.mocked(requireAuthorProfileEditAccess).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    await PATCH(
      new Request("http://localhost/api/authors/g2/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "G2" }),
      }),
      { params: Promise.resolve({ id: "g2" }) },
    );

    expect(requireAuthorProfileEditAccess).toHaveBeenCalledWith(
      expect.any(Request),
      "g2",
    );
    expect(updateAuthorDisplayProfile).not.toHaveBeenCalled();
  });
});
