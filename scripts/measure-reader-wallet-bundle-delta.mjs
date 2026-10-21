/**
 * Compare gzipped client bundle weight: origin/main vs current HEAD.
 * Builds twice with READER_WALLET_ENABLED=true (clean .next each run).
 *
 * Metrics:
 * - staticChunksGzip: sum of gzip(file) for every file under .next/static/chunks
 * - rootLayoutClientGzip: gzip sum of JS chunks listed for app/layout in the app build manifest
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function run(cmd, env = {}) {
  execSync(cmd, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const ent of readdirSafe(dir)) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function readdirSafe(dir) {
  return readdirSync(dir, { withFileTypes: true });
}

function gzipBytes(filePath) {
  const buf = readFileSync(filePath);
  return gzipSync(buf).length;
}

function measureBuild(label) {
  const chunksDir = join(repoRoot, ".next/static/chunks");
  const chunkFiles = walkFiles(chunksDir);
  let staticChunksGzip = 0;
  for (const file of chunkFiles) {
    staticChunksGzip += gzipBytes(file);
  }

  let rootLayoutClientGzip = 0;
  const manifestPath = join(repoRoot, ".next/app-build-manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const layoutEntry =
      manifest.pages?.["/layout"] ??
      manifest.pages?.["app/layout"] ??
      manifest.rootMainFiles;
    const files = Array.isArray(layoutEntry) ? layoutEntry : [];
    for (const rel of files) {
      const normalized = rel.startsWith("static/")
        ? join(repoRoot, ".next", rel)
        : join(repoRoot, ".next", rel.replace(/^\//, ""));
      if (existsSync(normalized) && normalized.endsWith(".js")) {
        rootLayoutClientGzip += gzipBytes(normalized);
      }
    }
  }

  return {
    label,
    staticChunksGzip,
    rootLayoutClientGzip,
    combinedGzip: staticChunksGzip + rootLayoutClientGzip,
    chunkFileCount: chunkFiles.length,
  };
}

function buildAtRef(ref) {
  run(`git checkout ${ref}`);
  rmSync(join(repoRoot, ".next"), { recursive: true, force: true });
  run("npm run build", { READER_WALLET_ENABLED: "true" });
}

const startRef = execSync("git rev-parse --abbrev-ref HEAD", {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();

try {
  buildAtRef("origin/main");
  const main = measureBuild("origin/main");

  buildAtRef(startRef);
  const head = measureBuild("HEAD");

  const delta = {
    staticChunksGzip: head.staticChunksGzip - main.staticChunksGzip,
    rootLayoutClientGzip: head.rootLayoutClientGzip - main.rootLayoutClientGzip,
    combinedGzip: head.combinedGzip - main.combinedGzip,
  };

  const report = { main, head, delta, generatedAt: new Date().toISOString() };
  const outPath =
    process.env.BUNDLE_REPORT_PATH ??
    join(repoRoot, "artifacts/reader-wallet-bundle-delta.json");
  mkdirSync(join(repoRoot, "artifacts"), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\nReader wallet bundle delta (READER_WALLET_ENABLED=true, gzip bytes):");
  console.log(
    `  static/chunks: main=${main.staticChunksGzip} head=${head.staticChunksGzip} Δ=${delta.staticChunksGzip}`,
  );
  console.log(
    `  root layout client: main=${main.rootLayoutClientGzip} head=${head.rootLayoutClientGzip} Δ=${delta.rootLayoutClientGzip}`,
  );
  console.log(
    `  combined: main=${main.combinedGzip} head=${head.combinedGzip} Δ=${delta.combinedGzip}`,
  );
  console.log(`Report: ${outPath}`);
} finally {
  run(`git checkout ${startRef}`);
}
