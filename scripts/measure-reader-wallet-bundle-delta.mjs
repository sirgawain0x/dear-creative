/**
 * Compare gzipped client bundle weight: origin/main vs HEAD (current checkout).
 * Builds each ref in an isolated git worktree with READER_WALLET_ENABLED=true.
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
const worktreeRoot = join(repoRoot, ".bundle-worktrees");

function run(cmd, cwd = repoRoot, env = {}) {
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function gzipBytes(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

function measureBuild(root) {
  const chunksDir = join(root, ".next/static/chunks");
  const chunkFiles = walkFiles(chunksDir);
  let staticChunksGzip = 0;
  for (const file of chunkFiles) {
    staticChunksGzip += gzipBytes(file);
  }

  let rootLayoutClientGzip = 0;
  const manifestPath = join(root, ".next/build-manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const files = Array.isArray(manifest.rootMainFiles) ? manifest.rootMainFiles : [];
    for (const rel of files) {
      const normalized = join(root, ".next", rel.replace(/^\//, ""));
      const alt = join(root, rel.replace(/^\//, ""));
      const filePath = existsSync(normalized) ? normalized : alt;
      if (existsSync(filePath) && filePath.endsWith(".js")) {
        rootLayoutClientGzip += gzipBytes(filePath);
      }
    }
  }

  return {
    staticChunksGzip,
    rootLayoutClientGzip,
    combinedGzip: staticChunksGzip + rootLayoutClientGzip,
    chunkFileCount: chunkFiles.length,
  };
}

function buildInDir(dir, label) {
  rmSync(join(dir, ".next"), { recursive: true, force: true });
  run("npm run db:migrate:local", dir, {
    LOCAL_DATABASE_URL: "file:./data/ci-dear-creative.db",
  });
  run("npx next build", dir, {
    READER_WALLET_ENABLED: "true",
    LOCAL_DATABASE_URL: "file:./data/ci-dear-creative.db",
  });
  const metrics = measureBuild(dir);
  return { label, ...metrics };
}

function prepareWorktree(name, ref) {
  const dir = join(worktreeRoot, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(worktreeRoot, { recursive: true });
  run(`git worktree add ${dir} ${ref}`);
  run("npm ci", dir);
  return dir;
}

const headRef = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
const mainDir = prepareWorktree("main", "origin/main");
const headDir = prepareWorktree("head", headRef);

const main = buildInDir(mainDir, "origin/main");
const head = buildInDir(headDir, "HEAD");

const delta = {
  staticChunksGzip: head.staticChunksGzip - main.staticChunksGzip,
  rootLayoutClientGzip: head.rootLayoutClientGzip - main.rootLayoutClientGzip,
  combinedGzip: head.combinedGzip - main.combinedGzip,
};

const report = {
  mainRef: "origin/main",
  headRef,
  main,
  head,
  delta,
  generatedAt: new Date().toISOString(),
};

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

run(`git worktree remove --force ${mainDir}`);
run(`git worktree remove --force ${headDir}`);
