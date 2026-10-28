import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthorByline } from "./author-byline";

describe("AuthorByline", () => {
  it("renders without patron UI when me_token columns are null", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorByline, {
        author: {
          name: "Alex Writer",
          slug: "alex-writer",
          bio: "Essays on creative tech.",
          avatarUrl: null,
          meTokenAddress: null,
          meTokenSymbol: null,
        },
      }),
    );

    expect(html).toContain("Alex Writer");
    expect(html).toContain("@alex-writer");
    expect(html).not.toContain("Patron token");
    expect(html).not.toContain('data-testid="author-patron-badge"');
  });

  it("renders tagline in full without line-clamp when provided", () => {
    const longTagline =
      "Music producer and builder helping creators own their work and their audience.";
    const html = renderToStaticMarkup(
      React.createElement(AuthorByline, {
        author: {
          name: "G2",
          slug: "g2",
          bio: "Long bio that would truncate in the byline if tagline were absent.",
          tagline: longTagline,
          avatarUrl: null,
          meTokenAddress: null,
          meTokenSymbol: null,
        },
      }),
    );

    expect(html).toContain(longTagline);
    expect(html).toContain('data-testid="author-tagline"');
    expect(html).not.toContain("line-clamp-1");
  });

  it("shows a display-only patron badge when me_token columns are set", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorByline, {
        author: {
          name: "Alex Writer",
          slug: "alex-writer",
          bio: null,
          avatarUrl: null,
          meTokenAddress: "0x1234567890123456789012345678901234567890",
          meTokenSymbol: "CRTVAI",
        },
      }),
    );

    expect(html).toContain("Patron token: $CRTVAI");
    expect(html).toContain('data-testid="author-patron-badge"');
    expect(html).not.toContain("Swap");
    expect(html).not.toContain("Mint");
  });
});

describe("AuthorByline import guard", () => {
  it("does not import trade, mint, wagmi, or QuickTrade modules", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/posts/author-byline.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["']@\/components\/metoken\//);
    expect(source).not.toMatch(/from\s+["']wagmi/);
    expect(source).not.toMatch(/QuickTradeModal/);
    expect(source).not.toMatch(/useWriteContract|useReadContract|useAccount/);
    expect(source).not.toMatch(/\bmint\b/i);
  });
});
