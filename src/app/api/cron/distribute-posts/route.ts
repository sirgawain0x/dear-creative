import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { auditEvents, deliveryReceipts } from "@/db/schema";
import { sendNewsletterEmail } from "@/lib/adam/deliver-email";
import { getEnabledChannels } from "@/lib/adam/distribution-config";
import { getAdamApiToken, requireAdamAuth } from "@/lib/adam/require-auth";
import { getRequiredPublicSiteUrl } from "@/lib/site/public-origin";

export const maxDuration = 300;

const SUCCESS_STATUSES = new Set([
  "posted",
  "sent",
  "success",
  "already_delivered",
]);

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    const auth = requireAdamAuth(request);
    if (!auth.ok) {
      return auth.response;
    }
  }

  const db = getDb();
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  // Find recent post.published events
  const events = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, "post.published"),
        gte(auditEvents.createdAt, tenMinutesAgo),
      ),
    )
    .orderBy(sql`${auditEvents.createdAt} DESC`)
    .limit(50);

  const uniquePosts: Array<{ postId: string; slug: string }> = [];
  const seenPostIds = new Set<string>();
  for (const event of events) {
    let payload: { postId?: string; slug?: string };
    try {
      payload = JSON.parse(event.payloadJson ?? "{}") as {
        postId?: string;
        slug?: string;
      };
    } catch {
      continue;
    }
    const postId = payload.postId?.trim();
    if (!postId || seenPostIds.has(postId)) {
      continue;
    }
    seenPostIds.add(postId);
    uniquePosts.push({ postId, slug: payload.slug ?? postId });
  }

  if (uniquePosts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No new posts to distribute",
      distributed: 0,
    });
  }

  const enabledChannels = getEnabledChannels();
  const adamToken = getAdamApiToken();
  const siteUrl = getRequiredPublicSiteUrl();
  const results: Array<{
    postId: string;
    slug: string;
    channel: string;
    status: string;
    error?: string;
  }> = [];

  for (const { postId, slug } of uniquePosts) {
    for (const channel of enabledChannels) {
      const [existing] = await db
        .select({
          status: deliveryReceipts.status,
          lastError: deliveryReceipts.lastError,
        })
        .from(deliveryReceipts)
        .where(
          and(
            eq(deliveryReceipts.postId, postId),
            eq(deliveryReceipts.channel, channel),
          ),
        )
        .limit(1);

      if (existing?.status === "completed") {
        results.push({
          postId,
          slug,
          channel,
          status: "already_delivered",
        });
        continue;
      }

      if (existing?.status === "needs_review") {
        results.push({
          postId,
          slug,
          channel,
          status: "needs_review",
          error: existing.lastError ?? "Delivery requires admin review",
        });
        continue;
      }

      if (channel === "email") {
        const idempotencyKey = `dist-${postId}-email-${Date.now()}`;
        try {
          const emailResult = await sendNewsletterEmail(db, {
            postId,
            idempotencyKey,
            actor: "adam",
          });
          if (emailResult.outcome === "sent") {
            results.push({ postId, slug, channel, status: "sent" });
          } else if (emailResult.outcome === "blocked") {
            if (emailResult.reason === "already_delivered") {
              results.push({
                postId,
                slug,
                channel,
                status: "already_delivered",
              });
            } else {
              results.push({
                postId,
                slug,
                channel,
                status: "blocked",
                error: emailResult.reason,
              });
            }
          } else if (emailResult.outcome === "provider_failed") {
            results.push({
              postId,
              slug,
              channel,
              status: "provider_failed",
              error: emailResult.errorMessage,
            });
          } else {
            results.push({
              postId,
              slug,
              channel,
              status: "needs_review",
              error: emailResult.message,
            });
          }
        } catch (err) {
          results.push({
            postId,
            slug,
            channel,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
        continue;
      }

      if (!adamToken || !siteUrl) {
        results.push({
          postId,
          slug,
          channel,
          status: "error",
          error: !adamToken
            ? "ADAM_API_TOKEN not configured"
            : "NEXT_PUBLIC_SITE_URL not configured",
        });
        continue;
      }

      const idempotencyKey = `dist-${postId}-${channel}-${Date.now()}`;
      try {
        const res = await fetch(`${siteUrl}/api/adam/deliver/${channel}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adamToken}`,
          },
          body: JSON.stringify({ postId, idempotencyKey }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          outcome?: string;
          reason?: string;
          error?: string;
          message?: string;
        };

        if (!res.ok && data.reason === "already_delivered") {
          results.push({
            postId,
            slug,
            channel,
            status: "already_delivered",
          });
        } else {
          results.push({
            postId,
            slug,
            channel,
            status: res.ok ? (data.outcome ?? "unknown") : `http_${res.status}`,
            error: res.ok ? undefined : (data.error ?? data.message),
          });
        }
      } catch (err) {
        results.push({
          postId,
          slug,
          channel,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  const failed = results.filter((r) => !SUCCESS_STATUSES.has(r.status)).length;

  return NextResponse.json({
    ok: failed === 0,
    message: `Distributed ${uniquePosts.length} post(s) to ${enabledChannels.length} channel(s)`,
    distributed: uniquePosts.length,
    channels: enabledChannels,
    results,
  });
}