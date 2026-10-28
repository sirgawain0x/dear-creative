import { parseRepurposePayload } from "./parse-payload";
import {
  repurposeOutputLabel,
  type RepurposeStoredOutput,
} from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isAbsoluteHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function sectionShell(title: string, innerHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;border-collapse:collapse;">
<tr><td style="padding:16px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-family:Helvetica,Arial,sans-serif;">
<p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6d28d9;">${escapeHtml(title)}</p>
${innerHtml}
</td></tr></table>`;
}

function renderMindMapHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("mind_map", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Mind map unavailable.</p>`;
  }
  const { data } = parsed;
  const branches = data.root.children
    .map((branch) => {
      const leaves = branch.children
        .map((leaf) => `<li style="margin:4px 0;">${escapeHtml(leaf.label)}</li>`)
        .join("");
      return `<li style="margin:8px 0;"><strong>${escapeHtml(branch.label)}</strong>${
        leaves ? `<ul style="margin:4px 0 0 16px;padding:0;">${leaves}</ul>` : ""
      }</li>`;
    })
    .join("");
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#18181b;">${escapeHtml(data.title)}</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#4c1d95;">${escapeHtml(data.root.label)}</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#3f3f46;">${branches}</ul>`;
}

function renderReportHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("report", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Report unavailable.</p>`;
  }
  const { data } = parsed;
  const sections = data.sections
    .map((s) => {
      const bullets =
        s.bullets && s.bullets.length > 0
          ? `<ul style="margin:8px 0 0;padding:0 0 0 18px;font-size:13px;color:#52525b;">${s.bullets
              .map((b) => `<li style="margin:2px 0;">${escapeHtml(b)}</li>`)
              .join("")}</ul>`
          : "";
      return `<tr><td style="padding:12px 0;border-top:1px solid #e4e4e7;"><p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#18181b;">${escapeHtml(s.heading)}</p><p style="margin:0;font-size:14px;line-height:1.5;color:#3f3f46;">${escapeHtml(s.body)}</p>${bullets}</td></tr>`;
    })
    .join("");
  const takeaways = data.keyTakeaways
    .map((t) => `<li style="margin:4px 0;">${escapeHtml(t)}</li>`)
    .join("");
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(data.title)}</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#3f3f46;">${escapeHtml(data.summary)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sections}</table>
<p style="margin:16px 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;color:#71717a;">Key takeaways</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:14px;">${takeaways}</ul>`;
}

function renderSlideDeckHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("slide_deck", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Slide deck unavailable.</p>`;
  }
  const slides = parsed.data.slides
    .map((slide, idx) => {
      const bullets = slide.bullets
        .map((b) => `<li style="margin:2px 0;">${escapeHtml(b)}</li>`)
        .join("");
      return `<tr><td style="padding:10px 0;border-top:1px solid #e4e4e7;"><p style="margin:0 0 4px;font-size:14px;font-weight:600;">${idx + 1}. ${escapeHtml(slide.title)}</p><ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#52525b;">${bullets}</ul></td></tr>`;
    })
    .join("");
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(parsed.data.title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${slides}</table>`;
}

function renderFlashcardsHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("flashcards", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Flashcards unavailable.</p>`;
  }
  const rows = parsed.data.cards
    .map(
      (card) =>
        `<tr><td style="padding:8px;border:1px solid #e4e4e7;vertical-align:top;width:50%;font-size:13px;"><strong>${escapeHtml(card.front)}</strong></td><td style="padding:8px;border:1px solid #e4e4e7;vertical-align:top;font-size:13px;color:#52525b;">${escapeHtml(card.back)}</td></tr>`,
    )
    .join("");
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(parsed.data.title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function renderQuizHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("quiz", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Quiz unavailable.</p>`;
  }
  const blocks = parsed.data.questions
    .map((q, qi) => {
      const choices = q.choices
        .map(
          (c, ci) =>
            `<li style="margin:2px 0;${ci === q.correctIndex ? "font-weight:600;color:#15803d;" : ""}">${String.fromCharCode(65 + ci)}. ${escapeHtml(c)}</li>`,
        )
        .join("");
      return `<p style="margin:12px 0 4px;font-size:14px;font-weight:600;">${qi + 1}. ${escapeHtml(q.prompt)}</p><ul style="margin:0 0 4px;padding:0 0 0 18px;font-size:13px;">${choices}</ul><p style="margin:0;font-size:12px;color:#71717a;">${escapeHtml(q.explanation)}</p>`;
    })
    .join("");
  return `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">${escapeHtml(parsed.data.title)}</p>${blocks}`;
}

function renderDataTableHtml(payload: unknown): string {
  const parsed = parseRepurposePayload("data_table", payload);
  if (!parsed.ok) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Data table unavailable.</p>`;
  }
  const header = parsed.data.columns
    .map(
      (c) =>
        `<th style="padding:8px;border:1px solid #d4d4d8;background:#f4f4f5;text-align:left;font-size:12px;">${escapeHtml(c)}</th>`,
    )
    .join("");
  const body = parsed.data.rows
    .map((row) => {
      const cells = parsed.data.columns
        .map(
          (_, ci) =>
            `<td style="padding:8px;border:1px solid #e4e4e7;font-size:12px;">${escapeHtml(row[ci] ?? "")}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<p style="margin:0 0 4px;font-size:16px;font-weight:600;">${escapeHtml(parsed.data.title)}</p>
<p style="margin:0 0 8px;font-size:13px;color:#52525b;">${escapeHtml(parsed.data.description)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderVideoOverviewHtml(
  output: RepurposeStoredOutput,
  postUrl: string,
  coverImageUrl: string | null | undefined,
): string {
  const link = output.mediaUrl ?? postUrl;
  const linkEscaped = escapeHtmlAttribute(link);
  const thumbBlock =
    coverImageUrl && isAbsoluteHttpsUrl(coverImageUrl)
      ? `<a href="${linkEscaped}" style="text-decoration:none;">
<img src="${escapeHtmlAttribute(coverImageUrl)}" alt="Video overview" width="560" style="display:block;max-width:100%;height:auto;border:0;border-radius:8px;" />
</a>`
      : "";
  const textLink = `<p style="margin:8px 0 0;font-size:13px;"><a href="${linkEscaped}" style="color:#6d28d9;">Open video overview →</a></p>`;
  return `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Watch the narrated video overview on the web (email clients cannot embed video).</p>
${thumbBlock}
${textLink}`;
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function renderInfographicHtml(output: RepurposeStoredOutput): string {
  if (!output.mediaUrl) {
    return `<p style="margin:0;font-size:14px;color:#71717a;">Infographic unavailable.</p>`;
  }
  if (!isAbsoluteHttpsUrl(output.mediaUrl)) {
    return `<p style="margin:0;font-size:13px;"><a href="${escapeHtmlAttribute(output.mediaUrl)}" style="color:#6d28d9;">Open infographic →</a></p>`;
  }
  return `<a href="${escapeHtmlAttribute(output.mediaUrl)}"><img src="${escapeHtmlAttribute(output.mediaUrl)}" alt="Infographic" width="560" style="display:block;max-width:100%;height:auto;border:0;border-radius:8px;" /></a>`;
}

export function renderRepurposeOutputEmailSection(input: {
  output: RepurposeStoredOutput;
  postUrl: string;
  coverImage?: string | null;
}): string {
  const label = repurposeOutputLabel(input.output.outputType);
  let inner = `<p style="margin:0;font-size:14px;color:#71717a;">Content unavailable.</p>`;
  switch (input.output.outputType) {
    case "mind_map":
      inner = renderMindMapHtml(input.output.payload);
      break;
    case "report":
      inner = renderReportHtml(input.output.payload);
      break;
    case "slide_deck":
      inner = renderSlideDeckHtml(input.output.payload);
      break;
    case "flashcards":
      inner = renderFlashcardsHtml(input.output.payload);
      break;
    case "quiz":
      inner = renderQuizHtml(input.output.payload);
      break;
    case "data_table":
      inner = renderDataTableHtml(input.output.payload);
      break;
    case "video_overview":
      inner = renderVideoOverviewHtml(
        input.output,
        input.postUrl,
        input.coverImage,
      );
      break;
    case "infographic":
      inner = renderInfographicHtml(input.output);
      break;
    default:
      break;
  }
  return sectionShell(label, inner);
}
