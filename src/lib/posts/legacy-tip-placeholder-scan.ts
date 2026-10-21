import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type LegacyTipPlaceholderScanResult = {
  scannedFiles: string[];
  matchingFiles: string[];
};

function shouldScanFile(name: string): boolean {
  return !name.endsWith(".test.ts");
}

/** Recursively lists files under `srcRoot`, skipping `*.test.ts`. */
export function listScannedSrcFiles(srcRoot: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const fullPath = join(dir, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && shouldScanFile(name)) {
        files.push(fullPath);
      }
    }
  }

  walk(srcRoot);
  return files;
}

/** Scans `src/` for `needle`, excluding `*.test.ts`. Throws if `src/` is unreadable. */
export function scanSrcForLegacyTipPlaceholder(
  projectRoot: string,
  needle: string,
): LegacyTipPlaceholderScanResult {
  const srcRoot = join(projectRoot, "src");
  const scannedFiles = listScannedSrcFiles(srcRoot);
  const matchingFiles: string[] = [];

  for (const filePath of scannedFiles) {
    const content = readFileSync(filePath, "utf8");
    if (content.includes(needle)) {
      matchingFiles.push(relative(projectRoot, filePath));
    }
  }

  return { scannedFiles, matchingFiles };
}
