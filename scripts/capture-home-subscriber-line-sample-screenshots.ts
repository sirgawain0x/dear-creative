import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT,
  HomeHeroSubscriberLineSample,
} from "../src/test/fixtures/home-hero-subscriber-line-sample";

const ARTIFACT_DIR = "/opt/cursor/artifacts/screenshots";
const SAMPLE_COUNT = HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT;

function buildSamplePageHtml(logoDataUri: string): string {
  const styles = readFileSync(
    join(process.cwd(), "scripts/home-subscriber-sample-styles.css"),
    "utf8",
  );
  const body = renderToStaticMarkup(
    HomeHeroSubscriberLineSample({
      count: SAMPLE_COUNT,
      logoSrc: logoDataUri,
    }),
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dear Creative — sample subscriber line (${SAMPLE_COUNT})</title>
    <style>${styles}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function captureWithPlaywrightCli(
  fileUrl: string,
  viewport: string,
  outputPath: string,
): void {
  execSync(
    [
      "npx playwright screenshot",
      `--viewport-size=${viewport}`,
      "--full-page",
      "--wait-for-timeout=1000",
      JSON.stringify(fileUrl),
      JSON.stringify(outputPath),
    ].join(" "),
    { stdio: "inherit" },
  );
}

function main() {
  const logoDataUri = `data:image/png;base64,${readFileSync(
    join(process.cwd(), "public/images/dear-creative-logo.png"),
  ).toString("base64")}`;
  const html = buildSamplePageHtml(logoDataUri);
  const htmlPath = join(ARTIFACT_DIR, "home-subscriber-line-sample-42.html");
  writeFileSync(htmlPath, html, "utf8");
  const fileUrl = pathToFileURL(htmlPath).href;

  captureWithPlaywrightCli(
    fileUrl,
    "390,900",
    join(ARTIFACT_DIR, "home-subscriber-line-sample-42-390.png"),
  );
  captureWithPlaywrightCli(
    fileUrl,
    "1440,900",
    join(ARTIFACT_DIR, "home-subscriber-line-sample-42-1440.png"),
  );

  console.log("Saved sample screenshots (count=42, not live):");
  console.log(join(ARTIFACT_DIR, "home-subscriber-line-sample-42-390.png"));
  console.log(join(ARTIFACT_DIR, "home-subscriber-line-sample-42-1440.png"));
}

main();
