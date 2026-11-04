import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNewsletterEmailContent } from "@/lib/adam/newsletter-email-content";
import { TOPIC_BUCKETS } from "@/lib/posts/topic-tagging";
import {
  buildPostPageMetadata,
  resolvePostOgImageAbsolute,
} from "@/lib/posts/post-page-metadata";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import {
  TOPIC_KEYS,
  TOPIC_LABELS,
  getTopicLabel,
} from "./labels";

const SITE = "https://news.example.com";
const REPO_ROOT = join(import.meta.dirname, "../../..");

const READER_SURFACE_FILES = [
  "src/app/posts/page.tsx",
  "src/app/posts/[slug]/page.tsx",
  "src/app/api/og/route.tsx",
  "src/lib/posts/post-page-metadata.ts",
  "src/lib/adam/newsletter-email-content.ts",
  "src/lib/adam/deliver-email.ts",
] as const;

function samplePost(topic: (typeof TOPIC_KEYS)[number]): PublishedPostDetail {
  return {
    slug: "topic-fixture",
    title: "Topic fixture post",
    publishedAt: "2026-10-01T12:00:00.000Z",
    excerpt: "Excerpt",
    canonicalUrl: null,
    coverImage: "data:image/svg+xml;utf8,abc",
    readMinutes: 3,
    listenMinutes: 4,
    readingTimeLabel: "3 min read",
    topic,
    bodyHtml: "<p>Body</p>",
    isGated: false,
  };
}

function collectReaderFacingStrings(): string[] {
  const bucketLabels = TOPIC_BUCKETS.filter((b) => b.id !== "all").map(
    (b) => b.label,
  );
  const ogUrls = TOPIC_KEYS.map((topic) =>
    resolvePostOgImageAbsolute(samplePost(topic), SITE),
  );
  const metadataJson = TOPIC_KEYS.map((topic) =>
    JSON.stringify(buildPostPageMetadata(samplePost(topic), SITE)),
  );
  const emailJson = JSON.stringify(
    buildNewsletterEmailContent({
      slug: "topic-fixture",
      canonicalUrl: null,
      isGated: false,
      freeContent: null,
      gatedContent: null,
      emailHtml: "<p>Newsletter</p>",
    }),
  );

  return [
    ...bucketLabels,
    ...TOPIC_KEYS.map((key) => getTopicLabel(key)),
    ...ogUrls,
    ...metadataJson,
    emailJson,
  ];
}

describe("topic reader surfaces", () => {
  it("never exposes raw topic keys in composed reader output", () => {
    const output = collectReaderFacingStrings().join("\n");
    for (const key of TOPIC_KEYS) {
      expect(output).not.toContain(key);
      expect(output).toContain(TOPIC_LABELS[key]);
    }
  });

  it("uses getTopicLabel for topic display in page components", () => {
    for (const rel of ["src/app/posts/page.tsx", "src/app/posts/[slug]/page.tsx"]) {
      const src = readFileSync(join(REPO_ROOT, rel), "utf8");
      expect(src).toContain("getTopicLabel");
      expect(src).not.toMatch(/\{post\.topic\}/);
    }
  });

  it("keeps raw keys only in non-reader contexts within surface files", () => {
    const allowedPatterns = [
      /topic=\$\{/,
      /topic ===/,
      /as TopicBucketId/,
      /slug:/,
      /id: "/,
      /case "/,
      /import /,
      /classifyArticleTopic/,
      /getTopicLabel/,
      /TOPIC_/,
      /\/\/ /,
      /\* /,
    ];

    for (const rel of READER_SURFACE_FILES) {
      const src = readFileSync(join(REPO_ROOT, rel), "utf8");
      for (const key of TOPIC_KEYS) {
        const lines = src.split("\n");
        for (const line of lines) {
          if (!line.includes(key)) continue;
          const allowed = allowedPatterns.some((pattern) => pattern.test(line));
          expect(
            allowed,
            `${rel} line exposes raw key "${key}": ${line.trim()}`,
          ).toBe(true);
        }
      }
    }
  });
});
