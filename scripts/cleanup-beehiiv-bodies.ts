import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { createDbClient } from "../src/db/client";
import * as schema from "../src/db/schema";
import { parseCleanupArgs } from "./cleanup-beehiiv-bodies/parse-args";
import {
  assertProdLiveConfirmationPhrase,
  isRemoteTursoUrl,
  PROD_LIVE_CONFIRMATION_PHRASE,
  resolveProdDatabaseUrl,
  safeDatabaseHost,
} from "./cleanup-beehiiv-bodies/prod-mode";
import {
  runBeehiivBodyCleanupFromCsv,
  runBeehiivBodyCleanupFromDb,
} from "./cleanup-beehiiv-bodies/run";

function assertNonProdSafeEnv(): void {
  const turso = process.env.TURSO_DATABASE_URL?.trim();
  if (turso && isRemoteTursoUrl(turso)) {
    console.error(
      "Refusing cleanup: remote TURSO_DATABASE_URL is set. Use --prod for Turso.",
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
      `Type "${PROD_LIVE_CONFIRMATION_PHRASE}" to clean Beehiiv bodies in production Turso: `,
    );
    assertProdLiveConfirmationPhrase(typed);
  } finally {
    rl.close();
  }
}

export async function runCleanupBeehiivBodiesMain(
  argv: string[],
  deps?: {
    readProdLiveConfirmation?: (confirmation?: string) => Promise<void>;
  },
): Promise<void> {
  const mode = parseCleanupArgs(argv);

  if (mode.live && !mode.prod) {
    throw new Error("Refusing --live without --prod.");
  }

  if (mode.prod && mode.live) {
    const confirm = deps?.readProdLiveConfirmation ?? readProdLiveConfirmation;
    await confirm(mode.prodLiveConfirmation);
  }

  let summary;
  if (mode.prod) {
    const databaseUrl = resolveProdDatabaseUrl();
    const client = createDbClient(databaseUrl);
    const db = drizzle({ client, schema });
    const postsCsv = mode.postsCsvPath
      ? readFileSync(mode.postsCsvPath, "utf8")
      : undefined;
    summary = await runBeehiivBodyCleanupFromDb({
      db,
      live: mode.live,
      prod: true,
      databaseHost: safeDatabaseHost(databaseUrl),
      postsCsvForSlugMap: postsCsv,
    });
  } else {
    assertNonProdSafeEnv();
    if (!mode.postsCsvPath) {
      throw new Error(
        "Usage: npm run import:beehiiv:cleanup -- [--prod] [--live] [--confirm \"IMPORT TO PROD\"] <posts.csv>",
      );
    }
    if (mode.live) {
      throw new Error("Local CSV cleanup cannot run --live (use --prod --live).");
    }
    summary = await runBeehiivBodyCleanupFromCsv({
      postsCsv: readFileSync(mode.postsCsvPath, "utf8"),
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  await runCleanupBeehiivBodiesMain(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
