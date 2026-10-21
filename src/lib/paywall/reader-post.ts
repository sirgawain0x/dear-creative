import { cookies } from "next/headers";
import { connection } from "next/server";
import type { DearCreativeDb } from "@/db/client";
import { getDb } from "@/db/client";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import { getPublishedPostRowBySlug } from "@/lib/posts/published-posts";
import { canReadFull } from "./can-read-full";
import { isPaywallEnabled } from "./feature-flag";
import {
  resolveFullReaderBodyHtml,
  resolvePublicReaderBodyHtml,
  type PostBodySource,
} from "./public-body";
import { resolveReaderFacingAudioUrl } from "./reader-gated-audio-url";
import { resolvePostPaywallCheckoutProps } from "./reader-post-checkout";
import { resolvePostViewerFromCookies } from "./viewer-from-cookies";

export type ReaderPostView = {
  post: PublishedPostDetail;
  canReadFull: boolean;
  showPaywall: boolean;
  paywallCheckout: Awaited<
    ReturnType<typeof resolvePostPaywallCheckoutProps>
  >;
};

export type PublishedPostWithPaywallFields = PublishedPostDetail & {
  postId: string;
  authorId: string | null;
  isGated: boolean;
  freeContent: string | null;
  gatedContent: string | null;
};

function toBodySource(
  row: PublishedPostWithPaywallFields,
): PostBodySource {
  return {
    isGated: row.isGated,
    bodyHtml: row.bodyHtml,
    freeContent: row.freeContent,
    gatedContent: row.gatedContent,
  };
}

export function applyReaderBodyToPost(
  row: PublishedPostWithPaywallFields,
  canReadFull: boolean,
): PublishedPostDetail {
  const source = toBodySource(row);
  const nextBody = canReadFull
    ? resolveFullReaderBodyHtml(source)
    : resolvePublicReaderBodyHtml(source);

  const publicPost = { ...row };
  delete (publicPost as { postId?: string }).postId;
  delete (publicPost as { authorId?: string | null }).authorId;
  delete (publicPost as { isGated?: boolean }).isGated;
  delete (publicPost as { freeContent?: string | null }).freeContent;
  delete (publicPost as { gatedContent?: string | null }).gatedContent;

  return {
    ...publicPost,
    bodyHtml: nextBody,
    audioUrl: resolveReaderFacingAudioUrl({
      slug: row.slug,
      isGated: row.isGated,
      storedAudioUrl: row.audioUrl,
    }),
  };
}

export async function loadPublishedPostWithPaywallFields(
  db: DearCreativeDb,
  slug: string,
): Promise<PublishedPostWithPaywallFields | null> {
  await connection();
  return getPublishedPostRowBySlug(db, slug);
}

export async function resolveReaderPostView(
  slug: string,
  options?: { db?: DearCreativeDb },
): Promise<ReaderPostView | null> {
  const db = options?.db ?? getDb();
  const row = await loadPublishedPostWithPaywallFields(db, slug);
  if (!row) {
    return null;
  }

  if (!isPaywallEnabled()) {
    return {
      post: applyReaderBodyToPost(row, true),
      canReadFull: true,
      showPaywall: false,
      paywallCheckout: null,
    };
  }

  const cookieStore = await cookies();
  const readCookie = (name: string) => cookieStore.get(name)?.value;
  const viewer = await resolvePostViewerFromCookies(db, readCookie);
  const entitled = await canReadFull(
    db,
    {
      isGated: row.isGated,
      authorId: row.authorId,
      postId: row.postId,
    },
    viewer,
  );
  const showPaywall = row.isGated && !entitled;
  const paywallCheckout = await resolvePostPaywallCheckoutProps(db, {
    slug,
    showPaywall,
  });

  return {
    post: applyReaderBodyToPost(row, entitled),
    canReadFull: entitled,
    showPaywall,
    paywallCheckout,
  };
}

/** Metadata and crawlers always see the unpaid/public slice for gated posts. */
export async function resolvePublicPostForMetadata(
  slug: string,
  options?: { db?: DearCreativeDb },
): Promise<PublishedPostDetail | null> {
  const db = options?.db ?? getDb();
  const row = await loadPublishedPostWithPaywallFields(db, slug);
  if (!row) {
    return null;
  }
  if (isPaywallEnabled() && row.isGated) {
    return applyReaderBodyToPost(row, false);
  }
  return applyReaderBodyToPost(row, true);
}
