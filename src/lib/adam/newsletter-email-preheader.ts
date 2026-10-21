/** Inbox preheader for batch send (no Resend previewText on /emails/batch). */
export function buildHiddenEmailPreheader(previewText: string): string {
  const escaped = previewText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;line-height:0;font-size:0;" aria-hidden="true">${escaped}</div>`;
}

export function prependHiddenEmailPreheader(
  html: string,
  previewText: string | undefined,
): string {
  const trimmed = previewText?.trim();
  if (!trimmed) {
    return html;
  }
  return `${buildHiddenEmailPreheader(trimmed)}\n${html}`;
}
