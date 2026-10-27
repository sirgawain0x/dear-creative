import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewLinksShareDialogFixture } from "../src/test/fixtures/preview-links-share-dialog-static";
import { PreviewPageFixture } from "../src/test/fixtures/preview-page-static";

const ARTIFACT_DIR = "/opt/cursor/artifacts/screenshots/preview-links";

function buildHtml(title: string, body: string): string {
  const styles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>${body}</body>
</html>`;
}

function capture(fileUrl: string, viewport: string, outputPath: string): void {
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
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const shareHtml = buildHtml(
    "Share preview dialog",
    renderToStaticMarkup(<PreviewLinksShareDialogFixture />),
  );
  const shareHtmlPath = join(ARTIFACT_DIR, "share-dialog.html");
  writeFileSync(shareHtmlPath, shareHtml, "utf8");
  const shareShot = join(ARTIFACT_DIR, "share-preview-dialog.png");
  capture(pathToFileURL(shareHtmlPath).href, "720,900", shareShot);

  const previewHtml = buildHtml(
    "Preview page",
    renderToStaticMarkup(<PreviewPageFixture />),
  );
  const previewHtmlPath = join(ARTIFACT_DIR, "preview-page.html");
  writeFileSync(previewHtmlPath, previewHtml, "utf8");
  const previewShot = join(ARTIFACT_DIR, "preview-page-banner.png");
  capture(pathToFileURL(previewHtmlPath).href, "1280,900", previewShot);

  console.log(shareShot);
  console.log(previewShot);
}

main();
