/**
 * Ported from sirgawain0x/crtv3 `lib/predictions/parse-prediction-display.ts`
 * (display parsing only — no Supabase / Precog / wallet code).
 */
import { keccak256, stringToHex } from "viem";
import {
  answerStringLocal,
  parseQuestionLocal,
  type LocalParsedQuestion,
} from "@/lib/predictions/parse-question-local";

const UNIT_SEP = "\u241F";

export type ParsedPredictionDisplay = {
  title: string;
  type: "bool" | "uint" | "single-select" | "multiple-select";
  outcomes: string[];
  category: string;
  language: string;
};

const ZERO_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const ONE_ANSWER =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const REALITY_TEMPLATE_ID_TO_TYPE: Record<
  number,
  ParsedPredictionDisplay["type"]
> = {
  0: "bool",
  1: "uint",
  2: "single-select",
  3: "multiple-select",
};

function parseOutcomesSegment(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // fall through
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .split('","')
      .map((s) => s.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return trimmed
    .split(",")
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

function inferTypeFromOutcomes(
  outcomes: string[],
): ParsedPredictionDisplay["type"] {
  if (outcomes.length === 2) {
    const lower = outcomes.map((o) => o.toLowerCase());
    if (
      (lower[0] === "yes" && lower[1] === "no") ||
      (lower[0] === "no" && lower[1] === "yes")
    ) {
      return "bool";
    }
    return "single-select";
  }
  if (outcomes.length > 2) return "single-select";
  return "bool";
}

function applyTemplateIdToDisplay(
  parsed: ParsedPredictionDisplay,
  templateId?: string | number | bigint | null,
): ParsedPredictionDisplay {
  if (templateId == null) return parsed;
  const id = Number(templateId);
  if (!Number.isFinite(id)) return parsed;

  const fromTemplate = REALITY_TEMPLATE_ID_TO_TYPE[id];
  if (!fromTemplate) return parsed;

  const next = { ...parsed, type: fromTemplate };
  if (fromTemplate === "uint") {
    next.outcomes = [];
  } else if (fromTemplate === "bool" && next.outcomes.length === 0) {
    next.outcomes = ["Yes", "No"];
  }
  return next;
}

export function parsePredictionDisplay(
  questionText: string,
  templateId?: string | number | bigint | null,
): ParsedPredictionDisplay {
  const raw = (questionText ?? "").trim();
  if (!raw) {
    return {
      title: "Untitled Prediction",
      type: "bool",
      outcomes: ["Yes", "No"],
      category: "general",
      language: "en_US",
    };
  }

  const local = parseQuestionLocal(raw);
  if (local) {
    return applyTemplateIdToDisplay(
      {
        title: local.title,
        type: local.type,
        outcomes: local.outcomes,
        category: local.category,
        language: "en_US",
      },
      templateId,
    );
  }

  const parts = raw.split(UNIT_SEP);
  const title = parts[0]?.trim() || raw;
  const outcomes = parts[1] ? parseOutcomesSegment(parts[1]) : [];
  const language =
    parts[parts.length - 1]?.trim().match(/^[a-z]{2}_[A-Z]{2}$/)
      ? parts[parts.length - 1].trim()
      : "en_US";

  const resolvedCategory =
    language.match(/^[a-z]{2}_[A-Z]{2}$/) && parts.length >= 3
      ? parts[parts.length - 2]?.trim() || "general"
      : parts[parts.length - 1]?.trim() || "general";

  const type = inferTypeFromOutcomes(outcomes);

  return applyTemplateIdToDisplay(
    {
      title,
      type,
      outcomes: outcomes.length ? outcomes : type === "bool" ? ["Yes", "No"] : [],
      category: resolvedCategory,
      language: language.match(/^[a-z]{2}_[A-Z]{2}$/) ? language : "en_US",
    },
    templateId,
  );
}

function decodeUintAnswer(answerHex: string): string | null {
  try {
    const value = BigInt(answerHex);
    if (value < BigInt(0) || value >= BigInt(2) ** BigInt(128)) return null;
    return value.toString();
  } catch {
    return null;
  }
}

function outcomeLabelFromIndex(
  answerHex: string,
  outcomes: string[],
): string | null {
  if (outcomes.length === 0) return null;
  try {
    const value = BigInt(answerHex);
    if (value >= BigInt(1) && value <= BigInt(outcomes.length)) {
      return outcomes[Number(value) - 1];
    }
    if (value < BigInt(outcomes.length)) {
      return outcomes[Number(value)];
    }
  } catch {
    return null;
  }
  return null;
}

export function answerBytesToLabel(
  answerHex: string | null | undefined,
  parsed: ParsedPredictionDisplay,
): string | null {
  if (!answerHex) return null;

  const local: LocalParsedQuestion = {
    title: parsed.title,
    type: parsed.type,
    outcomes: parsed.outcomes,
    category: parsed.category,
  };

  const label = answerStringLocal(local, answerHex);
  if (!label) return null;

  if (
    answerHex.toLowerCase() ===
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  ) {
    return "Invalid / Unresolvable";
  }

  if (parsed.type === "uint" && label === answerHex) {
    return decodeUintAnswer(answerHex) ?? label;
  }

  if (parsed.type !== "bool" && label === answerHex) {
    for (const outcome of parsed.outcomes) {
      try {
        if (keccak256(stringToHex(outcome)).toLowerCase() === answerHex.toLowerCase()) {
          return outcome;
        }
      } catch {
        continue;
      }
    }
    const indexLabel = outcomeLabelFromIndex(answerHex, parsed.outcomes);
    if (indexLabel) return indexLabel;
  }

  if (parsed.type === "bool") {
    if (answerHex.toLowerCase() === ONE_ANSWER.toLowerCase()) return "Yes";
    if (answerHex.toLowerCase() === ZERO_ANSWER.toLowerCase()) return "No";
  }

  return label;
}
