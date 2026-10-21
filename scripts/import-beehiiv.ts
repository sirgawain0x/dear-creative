import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDbClient } from "../src/db/client";
import * as schema from "../src/db/schema";
import { uploadToLensGrove } from "../src/lib/storage/lens-grove";
import {
  assertImportDatabaseUrl,
  formatBeehiivImportSummaryForLog,
  runBeehiivImport,
  type UploadImageFn,
} from "./beehiiv-import/lib";

function resolveImportDatabaseUrl(): string {
  const explicit = process.env.IMPORT_DATABASE_URL?.trim();
  if (explicit) {
    assertImportDatabaseUrl(explicit);
    return explicit;
  }

  const local = process.env.LOCAL_DATABASE_URL?.trim();
  if (local) {
    assertImportDatabaseUrl(local);
    return local;
  }

  const fallback = "file:./data/beehiiv-import-dry-run.db";
  assertImportDatabaseUrl(fallback);
  return fallback;
}

function assertSafeImportEnv(): void {
  if (process.env.TURSO_DATABASE_URL?.trim()) {
    const tursoUrl = process.env.TURSO_DATABASE_URL.trim();
    if (!tursoUrl.startsWith("file:") && !tursoUrl.startsWith(":memory:")) {
      console.error(
        "Refusing import: unset TURSO_DATABASE_URL or use a local file: URL only.",
      );
      process.exit(1);
    }
  }
}

function parseArgs(argv: string[]): {
  live: boolean;
  postsPath: string;
  subscribersPath: string;
} {
  const live = argv.includes("--live");
  const paths = argv.filter((arg) => !arg.startsWith("-"));
  if (paths.length < 2) {
    console.error(
      "Usage: npm run import:beehiiv -- [--live] <posts.csv> <subscribers.csv>",
    );
    process.exit(1);
  }
  return { live, postsPath: paths[0]!, subscribersPath: paths[1]! };
}

const groveUploadFn: UploadImageFn = async (bytes, fileName, contentType) => {
  const blob = new Blob([bytes], { type: contentType });
  return uploadToLensGrove(blob, fileName);
};

async function main() {
  assertSafeImportEnv();
  const { live, postsPath, subscribersPath } = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveImportDatabaseUrl();
  const postsCsv = readFileSync(postsPath, "utf8");
  const subscribersCsv = readFileSync(subscribersPath, "utf8");

  const client = createDbClient(databaseUrl);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  const summary = await runBeehiivImport({
    db,
    databaseUrl,
    postsCsv,
    subscribersCsv,
    live,
    uploadFn: live ? groveUploadFn : undefined,
  });

  console.log(JSON.stringify(formatBeehiivImportSummaryForLog(summary), null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
