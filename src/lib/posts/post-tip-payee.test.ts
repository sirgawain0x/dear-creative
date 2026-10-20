import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { authors, writers } from "@/db/schema";
import { setPostAuthorIdForTests } from "@/lib/adam/repurpose/post-source";
import {
  parseValidTipPayToAddress,
  resolvePostTipPayToAddress,
  shouldRenderPostTipCard,
} from "@/lib/posts/post-tip-payee";
import { scanSrcForLegacyTipPlaceholder } from "@/lib/posts/legacy-tip-placeholder-scan";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";

const POST_PAGE_REL = join("src", "app", "posts", "[slug]", "page.tsx");

const G2_SPLIT = "0xfc1577e86d0bc18c562a92e7e3a748e7177902af";
/** Legacy fallback (assembled so this file does not trip the src/ grep guard). */
const LEGACY_PLACEHOLDER_TIP = ["0x6B37", "a1F2a2d48074d2A6b40F001391515B70868a"].join(
  "",
);

describe("parseValidTipPayToAddress", () => {
  it("accepts a checksummed split address", () => {
    expect(parseValidTipPayToAddress(G2_SPLIT)).toBe(getAddress(G2_SPLIT));
  });

  it("rejects null, empty, invalid, and zero addresses", () => {
    expect(parseValidTipPayToAddress(null)).toBeNull();
    expect(parseValidTipPayToAddress("")).toBeNull();
    expect(parseValidTipPayToAddress("not-an-address")).toBeNull();
    expect(
      parseValidTipPayToAddress("0x0000000000000000000000000000000000000000"),
    ).toBeNull();
  });
});

describe("resolvePostTipPayToAddress", () => {
  it("returns the writer payout split when author_id joins to writers", async () => {
    const db = await createPostsTestDb();
    const writerId = "g2";
    await db.insert(writers).values({
      id: writerId,
      payoutSplitAddress: G2_SPLIT,
      payoutWalletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    });
    await db.insert(authors).values({
      id: writerId,
      name: "G2",
      slug: "g2",
      payoutAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    });
    await insertPost(db, {
      slug: "split-tip-post",
      title: "Split tip post",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Body</p>",
    });
    const post = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "split-tip-post"),
    });
    if (!post) throw new Error("missing post");
    await setPostAuthorIdForTests(db, post.id, writerId);

    await expect(resolvePostTipPayToAddress(db, "split-tip-post")).resolves.toBe(
      getAddress(G2_SPLIT),
    );
  });

  it("returns null when author_id is missing or split is invalid", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    await db.insert(writers).values({
      id: writerId,
      payoutSplitAddress: "0x0000000000000000000000000000000000000000",
    });
    await db.insert(authors).values({
      id: writerId,
      name: "Writer",
      slug: `writer-${writerId.slice(0, 8)}`,
      payoutAddress: "0x0000000000000000000000000000000000000001",
    });
    await insertPost(db, {
      slug: "no-author-post",
      title: "No author",
      status: "published",
      publishedAt: new Date(),
    });
    await insertPost(db, {
      slug: "bad-split-post",
      title: "Bad split",
      status: "published",
      publishedAt: new Date(),
    });
    const badPost = await db.query.posts.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.slug, "bad-split-post"),
    });
    if (!badPost) throw new Error("missing post");
    await setPostAuthorIdForTests(db, badPost.id, writerId);

    await expect(resolvePostTipPayToAddress(db, "no-author-post")).resolves.toBeNull();
    await expect(resolvePostTipPayToAddress(db, "bad-split-post")).resolves.toBeNull();
  });
});

describe("post tip card visibility", () => {
  it("hides the card when payToAddress is null", () => {
    expect(shouldRenderPostTipCard(null)).toBe(false);
  });

  it("shows the card when payToAddress is valid", () => {
    const addr = getAddress(G2_SPLIT);
    expect(shouldRenderPostTipCard(addr)).toBe(true);
  });

  it("wires the post page to resolver output and payToAddress prop", () => {
    const pageSrc = readFileSync(
      join(process.cwd(), "src/app/posts/[slug]/page.tsx"),
      "utf8",
    );
    expect(pageSrc).toContain("resolvePostTipPayToAddress");
    expect(pageSrc).toMatch(/shouldRenderPostTipCard\(payToAddress\)/);
    expect(pageSrc).toContain("payToAddress={payToAddress}");
  });

  it("requires payToAddress on MicroTippingWidget with no env fallback", () => {
    const widgetSrc = readFileSync(
      join(process.cwd(), "src/components/monetization/micro-tipping-widget.tsx"),
      "utf8",
    );
    expect(widgetSrc).not.toContain("NEXT_PUBLIC_TIP_ADDRESS");
    expect(widgetSrc).not.toContain(LEGACY_PLACEHOLDER_TIP);
    expect(widgetSrc).toMatch(/if\s*\(\s*!payToAddress\s*\)/);
  });
});

describe("tip placeholder guard", () => {
  it("fails if the legacy placeholder tip address appears anywhere under src/", () => {
    const projectRoot = process.cwd();
    const { scannedFiles, matchingFiles } = scanSrcForLegacyTipPlaceholder(
      projectRoot,
      LEGACY_PLACEHOLDER_TIP,
    );

    expect(scannedFiles.length).toBeGreaterThan(0);

    const scannedRelative = scannedFiles.map((file) =>
      relative(projectRoot, file),
    );
    expect(scannedRelative).toContain(POST_PAGE_REL);

    expect(matchingFiles).toEqual([]);
  });
});
