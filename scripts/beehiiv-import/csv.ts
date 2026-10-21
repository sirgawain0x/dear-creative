export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Parses RFC4180-style CSV including quoted fields that span newlines. */
export function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let row = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        row += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      row += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") {
        i++;
      }
      if (row.trim().length > 0) {
        records.push(splitCsvLine(row));
      }
      row = "";
      continue;
    }

    row += char;
  }

  if (row.trim().length > 0) {
    records.push(splitCsvLine(row));
  }

  return records;
}

export function parseCsvRows(content: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const records = parseCsvRecords(content);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0] ?? [];
  const rows = records.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
  return { headers, rows };
}
