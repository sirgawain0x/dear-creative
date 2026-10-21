import { createClient, type Client } from "@libsql/client";
import { isLocalLibsqlUrl, resolveDatabaseUrl } from "@/db/client";

/** Thrown when proxy cannot run a live lookup (no DB env); caller should fail open. */
export class ProxyPublishedLookupUnavailableError extends Error {
  constructor() {
    super("Proxy published-post lookup unavailable: no database env configured");
    this.name = "ProxyPublishedLookupUnavailableError";
  }
}

export function isProxyDatabaseConfigured(): boolean {
  const turso = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  if (turso && token) {
    return true;
  }
  return Boolean(process.env.LOCAL_DATABASE_URL?.trim());
}

/** Module-level singleton libsql client for proxy existence checks (reused across requests). */
let cachedClient: Client | null = null;

/** @internal Test hook to reset the singleton between unit tests. */
export function resetProxyLibsqlClientForTests(): void {
  cachedClient = null;
}

function getProxyLibsqlClient(): Client {
  if (cachedClient) {
    return cachedClient;
  }
  const url = resolveDatabaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!isLocalLibsqlUrl(url) && !authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required for remote libSQL URLs (not configured in this repo).",
    );
  }
  cachedClient = createClient({
    url,
    authToken: isLocalLibsqlUrl(url) ? undefined : authToken,
  });
  return cachedClient;
}

const PUBLISHED_POST_EXISTS_SQL = `SELECT id FROM posts
  WHERE slug = ?
    AND status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= ?
  LIMIT 1`;

/**
 * Proxy-only read path: libsql client runs this SELECT only (no writes).
 * @libsql/client has no separate read-only mode; isolation is by SQL shape.
 */
function executeProxyReadOnlySelect(
  client: Client,
  args: [string, number],
): ReturnType<Client["execute"]> {
  const normalized = PUBLISHED_POST_EXISTS_SQL.trim().replace(/\s+/g, " ");
  if (!normalized.toUpperCase().startsWith("SELECT ")) {
    throw new Error("Proxy database access is restricted to SELECT statements");
  }
  return client.execute({
    sql: PUBLISHED_POST_EXISTS_SQL,
    args,
  });
}

/** Minimal Turso existence probe for proxy (no Drizzle / no "use cache"). */
export async function existsPublishedPostBySlugForProxy(
  slug: string,
): Promise<boolean> {
  if (!isProxyDatabaseConfigured()) {
    throw new ProxyPublishedLookupUnavailableError();
  }

  const asOfMs = Date.now();
  const result = await executeProxyReadOnlySelect(getProxyLibsqlClient(), [
    slug,
    asOfMs,
  ]);
  return result.rows.length > 0;
}
