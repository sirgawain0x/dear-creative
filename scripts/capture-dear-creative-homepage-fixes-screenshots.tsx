import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeSubscribeCta } from "../src/components/home/home-subscribe-cta";
import { AuthorByline } from "../src/components/posts/author-byline";
import {
  AuthorProfileEditPreviewPage,
  AUTHOR_PROFILE_PREVIEW,
} from "../src/test/fixtures/author-profile-preview";

const prNumber = process.argv[2] ?? "4357";
const outDir = join(process.cwd(), "docs", "pr-assets", prNumber);
const artifactDir =
  process.env.PR_ASSET_DIR ?? "/opt/cursor/artifacts/screenshots";
const tmpDir = join(outDir, ".tmp");

const G2_TAGLINE =
  "Music producer and builder helping creators own their work and their audience.";

function readGlobalCss(): string {
  try {
    return readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  } catch {
    return "body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #18181b; }";
  }
}

function buildHtml(title: string, bodyMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${readGlobalCss()}</style>
  </head>
  <body class="antialiased">${bodyMarkup}</body>
</html>`;
}

function capture(viewport: string, fileUrl: string, outputPath: string): void {
  execSync(
    [
      "npx playwright screenshot",
      `--viewport-size=${viewport}`,
      "--full-page",
      "--wait-for-timeout=800",
      JSON.stringify(fileUrl),
      JSON.stringify(outputPath),
    ].join(" "),
    { stdio: "inherit" },
  );
}

function HomeAboutPreview() {
  const author = {
    name: "G2",
    slug: "g2",
    bio: "Onchain builder, editor, and newsletter host at Creative Platform.",
    tagline: G2_TAGLINE,
    avatarUrl: null,
    meTokenAddress: null,
    meTokenSymbol: null,
  };
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
          About this publication
        </h2>
        <AuthorByline author={author} className="border-none pb-0" />
        <p className="text-base leading-relaxed text-zinc-600">{author.bio}</p>
      </section>
    </main>
  );
}

function main() {
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  const pages = [
    {
      name: "homepage-subscribe-card",
      html: buildHtml(
        "Subscribe card",
        renderToStaticMarkup(
          <main className="mx-auto max-w-3xl px-6 py-16">
            <HomeSubscribeCta />
          </main>,
        ),
      ),
    },
    {
      name: "homepage-about-section",
      html: buildHtml(
        "About this publication",
        renderToStaticMarkup(<HomeAboutPreview />),
      ),
    },
    {
      name: "author-profile-edit",
      html: buildHtml(
        "Edit profile",
        renderToStaticMarkup(<AuthorProfileEditPreviewPage />),
      ),
    },
  ];

  const viewports = [
    { suffix: "desktop-1280", size: "1280,900" },
    { suffix: "mobile-390", size: "390,844" },
  ] as const;

  for (const page of pages) {
    const htmlPath = join(tmpDir, `${page.name}.html`);
    writeFileSync(htmlPath, page.html, "utf8");
    const fileUrl = pathToFileURL(htmlPath).href;
    for (const viewport of viewports) {
      const filename = `${page.name}-${viewport.suffix}.png`;
      const repoPath = join(outDir, filename);
      const artifactPath = join(artifactDir, filename);
      capture(viewport.size, fileUrl, repoPath);
      execSync(`cp ${JSON.stringify(repoPath)} ${JSON.stringify(artifactPath)}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      outDir,
      artifactDir,
      previewAuthor: AUTHOR_PROFILE_PREVIEW.name,
    }),
  );
}

main();
