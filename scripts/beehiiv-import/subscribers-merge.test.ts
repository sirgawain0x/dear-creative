import { describe, expect, it } from "vitest";
import {
  applyExistingSubscriberDbRules,
  mergeSubscriberImports,
  parseParagraphSubscriberRow,
  summarizeParagraphSubscriberCsv,
} from "./subscribers-merge";

const beehiivCsv = `subscriber_id,email,status,created_at,updated_at,unsubscribed_at
1,shared@example.test,active,2023-01-01 12:00:00 UTC,2023-01-01 12:00:00 UTC,
2,beehiiv-only@example.test,inactive,2023-01-01 12:00:00 UTC,2023-02-01 12:00:00 UTC,2023-02-01 12:00:00 UTC
`;

const paragraphCsv = `subscriberEmail,subscriberWallet,createdAt,type,utm,status,unsubscribedAt
"shared@example.test","","2023-06-14 20:30:33","IMPORTED",undefined,"UNSUBSCRIBED","2023-08-01 00:00:00"
"paragraph-only@example.test","","2023-06-14 20:30:33","IMPORTED",undefined,"UNSUBSCRIBED","2023-07-01 00:00:00"
"disabled@example.test","","2023-06-14 20:30:33","IMPORTED",undefined,"DISABLED",null
`;

describe("paragraph subscriber CSV", () => {
  it("strips UTF-8 BOM from header row", () => {
    const summary = summarizeParagraphSubscriberCsv(
      "\uFEFFsubscriberEmail,status\na@example.test,ACTIVE\n",
    );
    expect(summary.active).toBe(1);
  });

  it("maps ACTIVE/UNSUBSCRIBED/DISABLED and counts 347-scale statuses", () => {
    const summary = summarizeParagraphSubscriberCsv(paragraphCsv);
    expect(summary.active).toBe(0);
    expect(summary.suppressed).toBe(3);
    expect(summary.disabledAsSuppressed).toBe(1);
  });

  it("parses DISABLED as suppressed", () => {
    const row = parseParagraphSubscriberRow({
      subscriberEmail: "x@example.test",
      status: "DISABLED",
      createdAt: "2023-01-01 00:00:00",
    });
    expect(row?.disposition).toBe("suppressed");
    expect(row?.disabledAsSuppressed).toBe(true);
  });
});

describe("mergeSubscriberImports", () => {
  it("merges cross-file duplicates with suppression winning", () => {
    const merged = mergeSubscriberImports({
      beehiivCsv,
      paragraphCsv,
    });

    expect(merged.combined.crossFileDuplicateEmails).toBe(1);
    expect(merged.combined.conflictsResolvedToSuppressed).toBe(1);
    expect(
      merged.inserts.find((row) => row.email === "shared@example.test")?.status,
    ).toBe("unsubscribed");
    expect(merged.inserts.find((row) => row.email === "paragraph-only@example.test")?.source).toBe(
      "paragraph_import",
    );
  });

  it("never re-subscribes when DB already has suppressed row", () => {
    const merged = mergeSubscriberImports({ beehiivCsv, paragraphCsv });
    const applied = applyExistingSubscriberDbRules({
      inserts: merged.inserts,
      existingRows: [
        {
          email: "shared@example.test",
          status: "unsubscribed",
        },
      ],
    });
    expect(applied.toInsert.some((row) => row.email === "shared@example.test")).toBe(
      false,
    );
    expect(applied.dbSuppressedBlocksResubscribe).toBe(0);
  });

  it("blocks resubscribe when merge is active but DB is suppressed", () => {
    const merged = mergeSubscriberImports({
      beehiivCsv: `subscriber_id,email,status,created_at,updated_at,unsubscribed_at
1,active@example.test,active,2023-01-01 12:00:00 UTC,2023-01-01 12:00:00 UTC,
`,
    });
    const applied = applyExistingSubscriberDbRules({
      inserts: merged.inserts,
      existingRows: [{ email: "active@example.test", status: "unsubscribed" }],
    });
    expect(applied.toInsert).toHaveLength(0);
    expect(applied.dbSuppressedBlocksResubscribe).toBe(1);
  });
});
