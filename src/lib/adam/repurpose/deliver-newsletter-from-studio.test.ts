import { describe, expect, it, vi } from "vitest";
import {
  buildDeliverNewsletterEmailBody,
  deliverNewsletterEmailFromStudio,
} from "./deliver-newsletter-from-studio";
import * as newsletterIncludes from "./newsletter-includes";

describe("buildDeliverNewsletterEmailBody", () => {
  it("includes repurposeIncludes in the JSON body", () => {
    const body = buildDeliverNewsletterEmailBody({
      postId: "post-1",
      repurposeIncludes: ["mind_map", "quiz"],
      idempotencyKey: "test-key",
    });
    expect(body.postId).toBe("post-1");
    expect(body.repurposeIncludes).toEqual(["mind_map", "quiz"]);
    expect(body.idempotencyKey).toBe("test-key");
    expect(body.dryRun).toBe(true);
  });
});

describe("deliverNewsletterEmailFromStudio", () => {
  it("POSTs session includes to the deliver email API", async () => {
    vi.spyOn(newsletterIncludes, "getNewsletterRepurposeIncludesForPost").mockReturnValue(
      ["report"],
    );
    const authFetch = vi.fn(async () => new Response(JSON.stringify({ outcome: "sent" })));
    await deliverNewsletterEmailFromStudio({
      authFetch,
      postId: "post-abc",
      dryRun: true,
      idempotencyKey: "studio-key",
    });
    expect(authFetch).toHaveBeenCalledWith(
      "/api/adam/deliver/email",
      expect.objectContaining({ method: "POST" }),
    );
    const calls = authFetch.mock.calls as unknown as [string, RequestInit][];
    const init = calls[0]?.[1];
    expect(init?.body).toBeDefined();
    const parsed = JSON.parse(String(init!.body)) as {
      repurposeIncludes?: string[];
      postId?: string;
    };
    expect(parsed.postId).toBe("post-abc");
    expect(parsed.repurposeIncludes).toEqual(["report"]);
    vi.restoreAllMocks();
  });
});
