export const PROD_LIVE_CONFIRMATION_PHRASE = "IMPORT TO PROD";

export function safeDatabaseHost(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (trimmed.startsWith("file:")) {
    return "file:local";
  }
  if (trimmed.startsWith(":memory:")) {
    return ":memory:";
  }
  try {
    const parsed = new URL(trimmed.replace(/^libsql:/, "https:"));
    return parsed.hostname || "(unknown host)";
  } catch {
    return "(unknown host)";
  }
}

export function isRemoteTursoUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return !trimmed.startsWith("file:") && !trimmed.startsWith(":memory:");
}

export function resolveProdDatabaseUrl(): string {
  const turso = process.env.TURSO_DATABASE_URL?.trim();
  if (!turso) {
    throw new Error(
      "TURSO_DATABASE_URL is required for --prod (remote Turso cleanup).",
    );
  }
  if (!process.env.TURSO_AUTH_TOKEN?.trim()) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required for --prod (remote Turso cleanup).",
    );
  }
  return turso;
}

export function assertProdLiveConfirmationPhrase(input: string): void {
  if (input.trim() !== PROD_LIVE_CONFIRMATION_PHRASE) {
    throw new Error(
      `Refusing --prod --live: type exactly "${PROD_LIVE_CONFIRMATION_PHRASE}" to confirm.`,
    );
  }
}
