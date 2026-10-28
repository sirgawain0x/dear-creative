import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const REPURPOSE_SLIDE_WIDTH = 1280;
export const REPURPOSE_SLIDE_HEIGHT = 720;
export const REPURPOSE_SLIDE_BACKGROUND = "#1e1b4b";

let embeddedFontCssPromise: Promise<string> | null = null;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolveRepurposeSlideFontPath(): string {
  return join(process.cwd(), "src/assets/fonts/DejaVuSans.ttf");
}

async function loadEmbeddedFontFaceCss(): Promise<string> {
  if (!embeddedFontCssPromise) {
    embeddedFontCssPromise = (async () => {
      const fontPath = resolveRepurposeSlideFontPath();
      const fontBytes = await readFile(fontPath);
      const base64 = fontBytes.toString("base64");
      return `@font-face{font-family:"RepurposeDejaVu";src:url(data:font/truetype;charset=utf-8;base64,${base64}) format("truetype");font-weight:normal;font-style:normal;}`;
    })();
  }
  return embeddedFontCssPromise;
}

/** @internal */
export function resetRepurposeSlideFontCacheForTests(): void {
  embeddedFontCssPromise = null;
}

export function wrapSlideTitleLines(title: string, maxCharsPerLine = 28): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return ["Slide"];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 4);
}

export async function buildSlideTitleSvg(title: string): Promise<string> {
  const fontFace = await loadEmbeddedFontFaceCss();
  const lines = wrapSlideTitleLines(title.slice(0, 200));
  const lineHeight = 52;
  const fontSize = 42;
  const totalTextHeight = lines.length * lineHeight;
  const startY =
    REPURPOSE_SLIDE_HEIGHT / 2 - totalTextHeight / 2 + fontSize * 0.35;
  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      return `<tspan x="50%" y="${y}" text-anchor="middle">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${REPURPOSE_SLIDE_WIDTH}" height="${REPURPOSE_SLIDE_HEIGHT}" viewBox="0 0 ${REPURPOSE_SLIDE_WIDTH} ${REPURPOSE_SLIDE_HEIGHT}">
  <defs>
    <style type="text/css"><![CDATA[
      ${fontFace}
    ]]></style>
  </defs>
  <rect width="100%" height="100%" fill="${REPURPOSE_SLIDE_BACKGROUND}"/>
  <text font-family="RepurposeDejaVu, DejaVu Sans, sans-serif" font-size="${fontSize}" fill="#ffffff">${tspans}</text>
</svg>`;
}

export async function renderSlideTitlePng(input: {
  title: string;
  outputPath: string;
}): Promise<void> {
  const svg = await buildSlideTitleSvg(input.title);
  await sharp(Buffer.from(svg)).png().toFile(input.outputPath);
}
