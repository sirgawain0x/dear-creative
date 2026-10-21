import { createClient, type Client } from "@libsql/client";
import { isLocalLibsqlUrl, resolveDatabaseUrl } from "@/db/client";

let cachedClient: Client | null = null;

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

/** Minimal Turso existence probe for proxy (no Drizzle / no \"use cache\"). */
export async function existsPublishedPostBySlugForProxy(
  slug: string,
): Promise<boolean> {
  const asOfMs = Date.now();
  const result = await getProxyLibsqlClient().execute({
    sql: `SELECT id FROM posts
      WHERE slug = ?
        AND status = 'published'
        AND published_at IS NOT NULL
        AND published_at <= ?
      LIMIT 1`,
    args: [slug, asOfMs],
  });
  return result.rows.length > 0;
}
