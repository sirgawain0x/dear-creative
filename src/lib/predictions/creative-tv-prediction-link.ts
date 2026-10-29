/**
 * Creative TV prediction URL parsing.
 * Hosts mirror dear-creative video embed allowlist (`video-embed.ts`, `sanitize-article-html.ts`)
 * and crtv3 TV origin (`https://tv.creativeplatform.xyz`).
 */

export const CREATIVE_TV_PREDICTION_HOSTS = [
  "tv.creativeplatform.xyz",
  "creativeplatform.xyz",
  "creative.tv",
  "www.creative.tv",
  "crtv.xyz",
  "www.crtv.xyz",
] as const;

export const PREDICTION_QUESTION_ID_REGEX =
  /^0x[a-fA-F0-9]{64}$/;

const HOST_PATTERN = CREATIVE_TV_PREDICTION_HOSTS.map((h) =>
  h.replace(/\./g, "\\."),
).join("|");

const PREDICT_ABSOLUTE_URL_REGEX = new RegExp(
  `https?:\\/\\/(?:www\\.)?(?:${HOST_PATTERN})\\/predict\\/(0x[a-fA-F0-9]{64})(?:[/?#][^\\s"'<>)]*)?`,
  "gi",
);

export type ParsedCreativeTvPredictionLink = {
  questionId: `0x${string}`;
  viewUrl: string;
  matchedUrl: string;
};

export function normalizePredictionQuestionId(raw: string): `0x${string}` | null {
  const trimmed = raw.trim();
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!PREDICTION_QUESTION_ID_REGEX.test(withPrefix)) {
    return null;
  }
  return withPrefix.toLowerCase() as `0x${string}`;
}

function toAbsolutePredictUrl(host: string, questionId: string): string {
  const normalizedHost = host.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const base =
    normalizedHost === "creativeplatform.xyz"
      ? "https://tv.creativeplatform.xyz"
      : host.startsWith("http")
        ? host.replace(/\/$/, "")
        : `https://${normalizedHost.replace(/^www\./, "")}`;
  return `${base.replace(/\/$/, "")}/predict/${questionId}`;
}

/**
 * Parse a Creative TV `/predict/{questionId}` URL (absolute, or path-only with default TV origin).
 */
export function parseCreativeTvPredictionUrl(
  input: string,
  opts?: { defaultOrigin?: string },
): ParsedCreativeTvPredictionLink | null {
  const raw = input.trim();
  if (!raw) return null;

  const defaultOrigin = opts?.defaultOrigin ?? "https://tv.creativeplatform.xyz";

  const relativeMatch = /^\/predict\/(0x[a-fA-F0-9]{64})(?:[/?#].*)?$/i.exec(raw);
  if (relativeMatch?.[1]) {
    const questionId = normalizePredictionQuestionId(relativeMatch[1]);
    if (!questionId) return null;
    const viewUrl = `${defaultOrigin.replace(/\/$/, "")}/predict/${questionId}`;
    return { questionId, viewUrl, matchedUrl: raw };
  }

  PREDICT_ABSOLUTE_URL_REGEX.lastIndex = 0;
  const match = PREDICT_ABSOLUTE_URL_REGEX.exec(raw);
  if (!match?.[1]) {
    return null;
  }

  const questionId = normalizePredictionQuestionId(match[1]);
  if (!questionId) return null;

  const matchedUrl = match[0];
  const hostMatch = /^https?:\/\/(?:www\.)?([^/]+)/i.exec(matchedUrl);
  const hostPart = hostMatch?.[1] ?? "tv.creativeplatform.xyz";
  const viewUrl = toAbsolutePredictUrl(hostPart, questionId);

  return { questionId, viewUrl, matchedUrl };
}

/** Collect unique prediction links from plain text or HTML. */
export function findCreativeTvPredictionLinks(text: string): ParsedCreativeTvPredictionLink[] {
  const found: ParsedCreativeTvPredictionLink[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(PREDICT_ABSOLUTE_URL_REGEX)) {
    const parsed = parseCreativeTvPredictionUrl(match[0]);
    if (parsed && !seen.has(parsed.questionId)) {
      seen.add(parsed.questionId);
      found.push(parsed);
    }
  }

  for (const match of text.matchAll(/\/predict\/(0x[a-fA-F0-9]{64})/gi)) {
    const parsed = parseCreativeTvPredictionUrl(match[0]);
    if (parsed && !seen.has(parsed.questionId)) {
      seen.add(parsed.questionId);
      found.push(parsed);
    }
  }

  return found;
}
