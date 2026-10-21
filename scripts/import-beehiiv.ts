import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { createDbClient } from "../src/db/client";
import * as schema from "../src/db/schema";
import { uploadToLensGrove } from "../src/lib/storage/lens-grove";
import { parseImportBeehiivArgs } from "./beehiiv-import/parse-import-args";
import {
  assertImportDatabaseUrl,
  formatBeehiivImportSummaryForLog,
  runBeehiivImport,
  type UploadImageFn,
} from "./beehiiv-import/lib";
import {
  assertProdLiveConfirmationPhrase,
  isRemoteTursoUrl,
  PROD_LIVE_CONFIRMATION_PHRASE,
  resolveProdDatabaseUrl,
  safeDatabaseHost,
} from "./beehiiv-import/prod-mode";

function resolveLocalImportDatabaseUrl(): string {
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

function assertNonProdSafeEnv(): void {
  const turso = process.env.TURSO_DATABASE_URL?.trim();
  if (turso && isRemoteTursoUrl(turso)) {
    console.error(
      "Refusing import: remote TURSO_DATABASE_URL is set. Use --prod for Turso (read-only dry-run or confirmed --live).",
    );
    process.exit(1);
  }
}

async function readProdLiveConfirmation(
  argvConfirmation: string | undefined,
): Promise<void> {
  if (argvConfirmation) {
    assertProdLiveConfirmationPhrase(argvConfirmation);
    return;
  }

  const rl = createInterface({ input, output });
  try {
    const typed = await rl.question(
      `Type "${PROD_LIVE_CONFIRMATION_PHRASE}" to import into production Turso: `,
    );
    assertProdLiveConfirmationPhrase(typed);
  } finally {
    rl.close();
  }
}

const groveUploadFn: UploadImageFn = async (bytes, fileName, contentType) => {
  const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
  return uploadToLensGrove(blob, fileName);
};

export async function runImportBeehiivMain(
  argv: string[],
  deps?: {
    readProdLiveConfirmation?: (confirmation?: string) => Promise<void>;
  },
): Promise<void> {
  const mode = parseImportBeehiivArgs(argv);
  const postsCsv = readFileSync(mode.postsPath, "utf8");
  const subscribersCsv = readFileSync(mode.subscribersPath, "utf8");

  let databaseUrl: string;
  if (mode.prod) {
    databaseUrl = resolveProdDatabaseUrl();
  } else {
    assertNonProdSafeEnv();
    databaseUrl = resolveLocalImportDatabaseUrl();
  }

  if (mode.prod && mode.live) {
    const confirm = deps?.readProdLiveConfirmation ?? readProdLiveConfirmation;
    await confirm(mode.prodLiveConfirmation);
  }

  const client = createDbClient(databaseUrl);
  const db = drizzle({ client, schema });

  const summary = await runBeehiivImport({
    db,
    databaseUrl,
    postsCsv,
    subscribersCsv,
    live: mode.live,
    prod: mode.prod,
    uploadFn: mode.live ? groveUploadFn : undefined,
  });

  console.log(
    JSON.stringify(
      {
        ...formatBeehiivImportSummaryForLog(summary),
        databaseHost: safeDatabaseHost(databaseUrl),
      },
      null,
      2,
    ),
  );
}

async function main() {
  await runImportBeehiivMain(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
