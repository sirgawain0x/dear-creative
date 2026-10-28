const MISSING_COLUMN_PATTERN = /no such column/i;
const DEFAULT_MAX_CAUSE_DEPTH = 10;

function walkErrorMessages(
  error: unknown,
  maxDepth = DEFAULT_MAX_CAUSE_DEPTH,
): string[] {
  const messages: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth < maxDepth && current != null; depth += 1) {
    if (typeof current === "string") {
      messages.push(current);
      break;
    }

    if (current instanceof Error) {
      if (seen.has(current)) {
        break;
      }
      seen.add(current);
      messages.push(current.message);
      current = current.cause;
      continue;
    }

    if (typeof current === "object") {
      if (seen.has(current)) {
        break;
      }
      seen.add(current);
      messages.push(String(current));
      current = (current as { cause?: unknown }).cause;
      continue;
    }

    messages.push(String(current));
    break;
  }

  return messages;
}

export function isMissingColumnError(error: unknown): boolean {
  return walkErrorMessages(error).some((message) =>
    MISSING_COLUMN_PATTERN.test(message),
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "";
  }
  return walkErrorMessages(error).join(" ").toLowerCase();
}

export function isSqliteUniqueConstraintError(error: unknown): boolean {
  const message = errorMessage(error);
  if (!message) {
    return false;
  }
  return (
    message.includes("unique constraint failed") ||
    message.includes("sqlite_constraint_unique")
  );
}
