import { asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";
import { writers } from "@/db/schema";

type Db = LibSQLDatabase<typeof schema>;

/** Primary newsletter writer (Dear Creative owner row in `writers`). */
export async function getOwnerWriter(db: Db) {
  const [row] = await db
    .select()
    .from(writers)
    .orderBy(asc(writers.createdAt))
    .limit(1);
  return row ?? null;
}
