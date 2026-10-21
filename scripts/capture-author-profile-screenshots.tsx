import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AuthorProfileEditPreviewPage,
  AuthorProfilePreviewPage,
} from "../src/test/fixtures/author-profile-preview";

const prNumber = process.argv[2] ?? "draft";
const outDir = join(process.cwd(), "docs", "pr-assets", prNumber);
const tmpDir = join(outDir, ".tmp");

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

function main() {
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const profileHtml = buildHtml(
    "Author profile preview",
    renderToStaticMarkup(<AuthorProfilePreviewPage />),
  );
  const editHtml = buildHtml(
    "Author profile edit preview",
    renderToStaticMarkup(<AuthorProfileEditPreviewPage />),
  );

  const profilePath = join(tmpDir, "author-profile.html");
  const editPath = join(tmpDir, "author-profile-edit.html");
  writeFileSync(profilePath, profileHtml, "utf8");
  writeFileSync(editPath, editHtml, "utf8");

  const shots = [
    {
      html: profilePath,
      base: "author-profile",
    },
    {
      html: editPath,
      base: "author-profile-edit",
    },
  ] as const;

  for (const shot of shots) {
    const fileUrl = pathToFileURL(shot.html).href;
    capture(
      "390,900",
      fileUrl,
      join(outDir, `${shot.base}-mobile-390.png`),
    );
    capture(
      "1440,900",
      fileUrl,
      join(outDir, `${shot.base}-desktop-1440.png`),
    );
  }

  writeFileSync(
    join(outDir, "measurements.json"),
    JSON.stringify(
      {
        viewports: ["390x900", "1440x900"],
        note: "Static fixture markup; verify no horizontal overflow visually.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Saved author profile screenshots under ${outDir}`);
}

main();
