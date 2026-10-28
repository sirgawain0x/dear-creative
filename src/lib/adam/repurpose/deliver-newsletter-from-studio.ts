import { getNewsletterRepurposeIncludesForPost } from "./newsletter-includes";
import type { RepurposeNewsletterIncludeType } from "./types";

export function buildDeliverNewsletterEmailBody(input: {
  postId: string;
  repurposeIncludes: RepurposeNewsletterIncludeType[];
  dryRun?: boolean;
  idempotencyKey?: string;
}): {
  postId: string;
  idempotencyKey: string;
  dryRun: boolean;
  repurposeIncludes: RepurposeNewsletterIncludeType[];
} {
  return {
    postId: input.postId,
    idempotencyKey:
      input.idempotencyKey ??
      `studio:${input.postId}:${Date.now().toString(36)}`,
    dryRun: input.dryRun ?? true,
    repurposeIncludes: input.repurposeIncludes,
  };
}

/** Sends newsletter email using session-selected repurpose includes (Adam Studio). */
export async function deliverNewsletterEmailFromStudio(input: {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  postId: string;
  dryRun?: boolean;
  idempotencyKey?: string;
}): Promise<Response> {
  const repurposeIncludes = getNewsletterRepurposeIncludesForPost(input.postId);
  const body = buildDeliverNewsletterEmailBody({
    postId: input.postId,
    repurposeIncludes,
    dryRun: input.dryRun,
    idempotencyKey: input.idempotencyKey,
  });
  return input.authFetch("/api/adam/deliver/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
