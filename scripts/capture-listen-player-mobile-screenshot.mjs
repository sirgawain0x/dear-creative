import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  repoRoot,
  "tests/fixtures/listen-player-mobile.html",
);
const fixtureUrl = `file://${fixturePath}`;

const outDir =
  process.env.LISTEN_PLAYER_ARTIFACT_DIR ||
  path.join(repoRoot, "docs/artifacts");
const pngPath = path.join(outDir, "listen-player-mobile-390w.png");

await mkdir(outDir, { recursive: true });

const chrome =
  process.env.CHROME_BIN ||
  process.env.GOOGLE_CHROME_BIN ||
  "google-chrome";

const userDataDir =
  process.env.CHROME_USER_DATA_DIR ||
  path.join(repoRoot, ".tmp", "chrome-screenshot-profile");

const result = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--user-data-dir=${userDataDir}`,
    "--virtual-time-budget=3000",
    "--hide-scrollbars",
    `--window-size=390,520`,
    `--screenshot=${pngPath}`,
    fixtureUrl,
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

console.log(pngPath);
