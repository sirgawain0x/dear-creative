import { isValidEmail } from "../paragraph-import/lib";
import { parseCsvRows } from "./csv";
import { parseBeehiivSubscriberRow } from "./beehiiv-subscribers";
import type { subscribers } from "../../src/db/schema";

export type SubscriberSource = "beehiiv_import" | "paragraph_import";

export type SubscriberFileSummary = {
  csvRows: number;
  active: number;
  suppressed: number;
  skipped: number;
  /** Paragraph DISABLED rows counted as suppressed (CTO open question). */
  disabledAsSuppressed?: number;
};

export type CombinedSubscriberSummary = {
  crossFileDuplicateEmails: number;
  conflictsResolvedToSuppressed: number;
  activeAfterMerge: number;
  suppressedAfterMerge: number;
  skippedAfterMerge: number;
  existingEmailsSkipped: number;
  dbSuppressedBlocksResubscribe: number;
  toInsertActive: number;
  toInsertSuppressed: number;
};

export type MergedSubscriberInsert = {
  email: string;
  status: "subscribed" | "unsubscribed";
  source: SubscriberSource;
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
};

type InternalRow = {
  email: string;
  disposition: "active" | "suppressed";
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
  source: SubscriberSource;
  files: Set<"beehiiv" | "paragraph">;
};

const OPEN_QUESTIONS = [
  "Paragraph status DISABLED is imported as suppressed (unsubscribed); confirm with CTO if DISABLED should be skipped instead.",
] as const;

function parseLooseTimestamp(raw: string | null | undefined): Date | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return null;
  }
  const withUtc = trimmed.includes("UTC")
    ? trimmed.replace(" UTC", "Z").replace(" ", "T")
    : `${trimmed.replace(" ", "T")}Z`;
  const ms = Date.parse(withUtc);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}

export function parseParagraphSubscriberRow(
  row: Record<string, string>,
): {
  email: string;
  disposition: "active" | "suppressed" | "skip";
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
  disabledAsSuppressed: boolean;
} | null {
  const rawEmail = (row.subscriberEmail ?? row.email ?? "").trim();
  if (!rawEmail) {
    return null;
  }
  const email = rawEmail.toLowerCase();
  const status = (row.status ?? "").trim().toUpperCase();
  const subscribedAt = parseLooseTimestamp(row.createdAt ?? row.created_at);
  const unsubscribedAt = parseLooseTimestamp(
    row.unsubscribedAt ?? row.unsubscribed_at,
  );

  if (status === "ACTIVE") {
    return {
      email,
      disposition: "active",
      subscribedAt,
      unsubscribedAt: null,
      disabledAsSuppressed: false,
    };
  }
  if (status === "UNSUBSCRIBED" || status === "DISABLED") {
    return {
      email,
      disposition: "suppressed",
      subscribedAt,
      unsubscribedAt: unsubscribedAt ?? subscribedAt,
      disabledAsSuppressed: status === "DISABLED",
    };
  }
  return {
    email,
    disposition: "skip",
    subscribedAt: null,
    unsubscribedAt: null,
    disabledAsSuppressed: false,
  };
}

export function summarizeBeehiivSubscriberCsv(content: string): SubscriberFileSummary {
  const { rows } = parseCsvRows(content);
  let active = 0;
  let suppressed = 0;
  let skipped = 0;

  for (const row of rows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (!parsed || parsed.status === "other") {
      skipped += 1;
      continue;
    }
    if (parsed.status === "pending") {
      skipped += 1;
      continue;
    }
    if (!isValidEmail(parsed.email)) {
      skipped += 1;
      continue;
    }
    if (parsed.status === "active") {
      active += 1;
    } else if (parsed.status === "inactive") {
      suppressed += 1;
    }
  }

  return { csvRows: rows.length, active, suppressed, skipped };
}

export function summarizeParagraphSubscriberCsv(
  content: string,
): SubscriberFileSummary {
  const { rows } = parseCsvRows(content);
  let active = 0;
  let suppressed = 0;
  let skipped = 0;
  let disabledAsSuppressed = 0;

  for (const row of rows) {
    const parsed = parseParagraphSubscriberRow(row);
    if (!parsed) {
      skipped += 1;
      continue;
    }
    if (parsed.disposition === "skip" || !isValidEmail(parsed.email)) {
      skipped += 1;
      continue;
    }
    if (parsed.disposition === "active") {
      active += 1;
    } else {
      suppressed += 1;
      if (parsed.disabledAsSuppressed) {
        disabledAsSuppressed += 1;
      }
    }
  }

  return {
    csvRows: rows.length,
    active,
    suppressed,
    skipped,
    disabledAsSuppressed,
  };
}

function beehiivRowsToInternal(content: string): InternalRow[] {
  const { rows } = parseCsvRows(content);
  const out: InternalRow[] = [];
  for (const row of rows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (
      !parsed ||
      parsed.status === "pending" ||
      parsed.status === "other" ||
      !isValidEmail(parsed.email)
    ) {
      continue;
    }
    out.push({
      email: parsed.email,
      disposition: parsed.status === "active" ? "active" : "suppressed",
      subscribedAt: parsed.subscribedAt,
      unsubscribedAt: parsed.unsubscribedAt,
      source: "beehiiv_import",
      files: new Set(["beehiiv"]),
    });
  }
  return out;
}

function paragraphRowsToInternal(content: string): InternalRow[] {
  const { rows } = parseCsvRows(content);
  const out: InternalRow[] = [];
  for (const row of rows) {
    const parsed = parseParagraphSubscriberRow(row);
    if (
      !parsed ||
      parsed.disposition === "skip" ||
      !isValidEmail(parsed.email)
    ) {
      continue;
    }
    out.push({
      email: parsed.email,
      disposition: parsed.disposition,
      subscribedAt: parsed.subscribedAt,
      unsubscribedAt: parsed.unsubscribedAt,
      source: "paragraph_import",
      files: new Set(["paragraph"]),
    });
  }
  return out;
}

export function mergeSubscriberImports(input: {
  beehiivCsv: string;
  paragraphCsv?: string;
}): {
  beehiiv: SubscriberFileSummary;
  paragraph: SubscriberFileSummary | null;
  combined: CombinedSubscriberSummary;
  inserts: MergedSubscriberInsert[];
  openQuestions: readonly string[];
} {
  const beehiiv = summarizeBeehiivSubscriberCsv(input.beehiivCsv);
  const paragraph = input.paragraphCsv
    ? summarizeParagraphSubscriberCsv(input.paragraphCsv)
    : null;

  const merged = new Map<string, InternalRow>();
  let conflictsResolvedToSuppressed = 0;

  const ingest = (row: InternalRow) => {
    const existing = merged.get(row.email);
    if (!existing) {
      merged.set(row.email, {
        ...row,
        files: new Set(row.files),
      });
      return;
    }

    row.files.forEach((file) => existing.files.add(file));

    const wasActive = existing.disposition === "active";
    const incomingActive = row.disposition === "active";
    if (wasActive !== incomingActive) {
      conflictsResolvedToSuppressed += 1;
    }

    if (existing.disposition === "suppressed" || row.disposition === "suppressed") {
      existing.disposition = "suppressed";
      existing.unsubscribedAt =
        row.unsubscribedAt ?? existing.unsubscribedAt ?? row.subscribedAt;
      if (row.disposition === "suppressed") {
        existing.source = row.source;
      }
    }

    if (existing.disposition === "active" && row.disposition === "active") {
      existing.subscribedAt =
        existing.subscribedAt ?? row.subscribedAt ?? null;
    }
  };

  for (const row of beehiivRowsToInternal(input.beehiivCsv)) {
    ingest(row);
  }
  if (input.paragraphCsv) {
    for (const row of paragraphRowsToInternal(input.paragraphCsv)) {
      ingest(row);
    }
  }

  let activeAfterMerge = 0;
  let suppressedAfterMerge = 0;
  let crossFileDuplicateEmails = 0;
  for (const row of merged.values()) {
    if (row.files.size > 1) {
      crossFileDuplicateEmails += 1;
    }
    if (row.disposition === "active") {
      activeAfterMerge += 1;
    } else {
      suppressedAfterMerge += 1;
    }
  }

  return {
    beehiiv,
    paragraph,
    combined: {
      crossFileDuplicateEmails,
      conflictsResolvedToSuppressed,
      activeAfterMerge,
      suppressedAfterMerge,
      skippedAfterMerge: beehiiv.skipped + (paragraph?.skipped ?? 0),
      existingEmailsSkipped: 0,
      dbSuppressedBlocksResubscribe: 0,
      toInsertActive: activeAfterMerge,
      toInsertSuppressed: suppressedAfterMerge,
    },
    inserts: [...merged.values()].map((row) => ({
      email: row.email,
      status: row.disposition === "active" ? "subscribed" : "unsubscribed",
      source: row.source,
      subscribedAt: row.subscribedAt,
      unsubscribedAt: row.unsubscribedAt,
    })),
    openQuestions: paragraph ? OPEN_QUESTIONS : [],
  };
}

export function applyExistingSubscriberDbRules(input: {
  inserts: MergedSubscriberInsert[];
  existingRows: Array<{
    email: string;
    status: (typeof subscribers.$inferSelect)["status"];
  }>;
}): {
  toInsert: MergedSubscriberInsert[];
  existingEmailsSkipped: string[];
  dbSuppressedBlocksResubscribe: number;
} {
  const byEmail = new Map(
    input.existingRows.map((row) => [row.email.toLowerCase(), row.status]),
  );
  const toInsert: MergedSubscriberInsert[] = [];
  const existingEmailsSkipped: string[] = [];
  let dbSuppressedBlocksResubscribe = 0;

  for (const row of input.inserts) {
    const existingStatus = byEmail.get(row.email);
    if (!existingStatus) {
      toInsert.push(row);
      continue;
    }

    existingEmailsSkipped.push(row.email);

    if (
      row.status === "subscribed" &&
      (existingStatus === "unsubscribed" || existingStatus === "bounced")
    ) {
      dbSuppressedBlocksResubscribe += 1;
    }
  }

  return {
    toInsert,
    existingEmailsSkipped,
    dbSuppressedBlocksResubscribe,
  };
}
