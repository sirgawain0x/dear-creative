import { desc } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { posts } from "@/db/schema";
import {
  ensureArticleHtml,
  renderMarkdownToSafeHtml,
} from "@/lib/html/markdown-to-html";
import { sanitizeArticleHtml } from "@/lib/html/sanitize-article-html";
import { replaceBannerInHtml } from "@/lib/posts/banner-swap";
import { generateDeterministicBannerSvg } from "@/lib/posts/post-cover-image";
import { getRecentFeedbackSummaryForEditorial } from "@/lib/posts/post-feedback";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import { fetchActiveSponsors } from "./fetch-sponsors";
import {
  createAdamIdea,
  getAdamIdeaById,
  listAdamIdeas,
  markAdamIdeaDrafted,
  type AdamIdeaRecord,
  type IdeaAttachmentMeta,
} from "./ideas";
import {
  DuplicateSlugError,
  findPostBySlug,
  publishDraftToTurso,
  type PublishDraftResult,
} from "./publish-draft";
import {
  getOrCreateAdamSchedule,
  recordAdamScheduleRun,
  type AdamScheduleRecord,
} from "./schedule";

export type StudioAttachmentInput = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Base64-encoded payload (no data: prefix) for images, PDFs, or audio */
  base64Data?: string;
  /** Decoded text content for text/markdown/csv/json files */
  textContent?: string;
};

export type StudioChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: IdeaAttachmentMeta[];
};

export type DraftProposal = {
  slug: string;
  title: string;
  teaserText: string;
  emailSubject: string;
  emailHtml: string;
  bodyHtml: string;
  sponsorId?: string | null;
};

export type GeneratedBannerResult = {
  url: string;
  uri: string;
  storageKey: string;
  mimeType: string;
  promptUsed: string;
  provider: "gemini-image" | "nano-banana" | "deterministic-svg";
};

export type GeneratedVideoResult = {
  url: string;
  uri: string;
  storageKey: string;
  mimeType: string;
  promptUsed: string;
  provider: "gemini-omni" | "veo";
};

/** Default generative media models (override via ADAM_* env vars). */
export const DEFAULT_ADAM_GEMINI_VIDEO_MODEL = "gemini-omni-1.1-flash";
export const DEFAULT_ADAM_IMAGEN_MODEL = "gemini-nano-banana-2.1";

function resolveAdamGeminiVideoModel(): string {
  return (
    process.env.ADAM_GEMINI_VIDEO_MODEL?.trim() ||
    DEFAULT_ADAM_GEMINI_VIDEO_MODEL
  );
}

function resolveAdamImageFallbackModel(): string {
  return (
    process.env.ADAM_IMAGEN_MODEL?.trim() || DEFAULT_ADAM_IMAGEN_MODEL
  );
}

function usesLegacyVeoPredictApi(model: string): boolean {
  return model.startsWith("veo-");
}

/** Wall-clock budget for Adam video generation (ms), below Vercel 300s limit. */
export const ADAM_VIDEO_ROUTE_BUDGET_MS = 290_000;
export const ADAM_VIDEO_DEFAULT_POLL_INTERVAL_MS = 5_000;
export const ADAM_VIDEO_DEFAULT_FETCH_TIMEOUT_MS = 45_000;

export const ADAM_VIDEO_WALL_TIMEOUT_MESSAGE =
  "Adam video generation exceeded the 290s wall-clock budget";

export function createAdamVideoDeadline(
  budgetMs: number = ADAM_VIDEO_ROUTE_BUDGET_MS,
  nowMs: number = Date.now(),
): number {
  return nowMs + budgetMs;
}

function remainingAdamVideoBudgetMs(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): number {
  return deadlineAtMs - nowMs;
}

function throwIfAdamVideoDeadlineExceeded(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): void {
  if (remainingAdamVideoBudgetMs(deadlineAtMs, nowMs) <= 0) {
    throw new Error(ADAM_VIDEO_WALL_TIMEOUT_MESSAGE);
  }
}

export function buildAdamVideoFetchSignal(
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowMs: number = Date.now(),
): AbortSignal {
  const remaining = remainingAdamVideoBudgetMs(deadlineAtMs, nowMs);
  if (remaining <= 0) {
    return AbortSignal.timeout(0);
  }
  const perFetchMs = Math.min(perFetchCapMs, remaining);
  if (perFetchMs >= remaining) {
    return AbortSignal.timeout(perFetchMs);
  }
  return AbortSignal.any([
    AbortSignal.timeout(perFetchMs),
    AbortSignal.timeout(remaining),
  ]);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function rethrowAdamVideoFetchError(err: unknown): never {
  if (isAbortError(err)) {
    throw new Error(ADAM_VIDEO_WALL_TIMEOUT_MESSAGE);
  }
  throw err;
}

async function fetchWithAdamVideoDeadline(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit | undefined,
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowMs: number = Date.now(),
): Promise<Response> {
  throwIfAdamVideoDeadlineExceeded(deadlineAtMs, nowMs);
  const signal = buildAdamVideoFetchSignal(deadlineAtMs, perFetchCapMs, nowMs);
  try {
    return await fetchFn(url, { ...init, signal });
  } catch (err) {
    rethrowAdamVideoFetchError(err);
  }
}

async function uploadVideoWithAdamDeadline(
  uploadFn: (
    file: File | Blob,
    fileName?: string,
    signal?: AbortSignal,
  ) => Promise<LensGroveUploadResult>,
  file: Blob,
  fileName: string,
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowMs: number = Date.now(),
): Promise<LensGroveUploadResult> {
  throwIfAdamVideoDeadlineExceeded(deadlineAtMs, nowMs);
  const signal = buildAdamVideoFetchSignal(deadlineAtMs, perFetchCapMs, nowMs);
  const uploadPromise = uploadFn(file, fileName, signal);
  const abortPromise = new Promise<never>((_, reject) => {
    const fail = () => reject(new Error(ADAM_VIDEO_WALL_TIMEOUT_MESSAGE));
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener("abort", fail, { once: true });
  });
  try {
    return await Promise.race([uploadPromise, abortPromise]);
  } catch (err) {
    rethrowAdamVideoFetchError(err);
  }
}

function geminiInteractionsUrl(): string {
  return "https://generativelanguage.googleapis.com/v1beta/interactions";
}

function geminiApiKeyHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

function logGeminiHttpFailure(status: number): void {
  console.error(`Gemini HTTP ${status}`);
}

async function fetchWithPerRequestTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  return fetchFn(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

async function readGeminiResponseOrThrow(
  res: Response,
  label: string,
): Promise<unknown> {
  if (!res.ok) {
    logGeminiHttpFailure(res.status);
    throw new Error(`${label} (${res.status})`);
  }
  return res.json();
}

function assertGeminiInteractionCompleted(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("Gemini interaction returned an invalid payload");
  }
  const status = (payload as { status?: string }).status;
  if (status !== "completed") {
    throw new Error(
      `Gemini interaction not completed${status ? ` (${status})` : ""}`,
    );
  }
}

function parseGeminiFilesResourceFromUri(uri: string): string | null {
  const match = uri.match(/\/files\/([^/:?]+)/);
  return match ? `files/${match[1]}` : null;
}

async function pollGeminiFileUntilActive(input: {
  fetchFn: typeof fetch;
  apiKey: string;
  filesResource: string;
  pollIntervalMs: number;
  fetchTimeoutMs: number;
  deadlineAtMs: number;
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
}): Promise<void> {
  const resource = input.filesResource.replace(/^\//, "");
  const nowFn = input.nowFn ?? Date.now;
  const sleepFn =
    input.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let polledBefore = false;

  while (true) {
    throwIfAdamVideoDeadlineExceeded(input.deadlineAtMs, nowFn());
    if (polledBefore && input.pollIntervalMs > 0) {
      const nowBeforeSleep = nowFn();
      const fetchTimeoutBeforePoll = Math.min(
        input.fetchTimeoutMs,
        remainingAdamVideoBudgetMs(input.deadlineAtMs, nowBeforeSleep),
      );
      if (
        nowBeforeSleep + input.pollIntervalMs + fetchTimeoutBeforePoll >
        input.deadlineAtMs
      ) {
        throw new Error(ADAM_VIDEO_WALL_TIMEOUT_MESSAGE);
      }
      await sleepFn(input.pollIntervalMs);
    }
    polledBefore = true;

    const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${resource}`;
    const statusRes = await fetchWithAdamVideoDeadline(
      input.fetchFn,
      statusUrl,
      {
        method: "GET",
        headers: { "x-goog-api-key": input.apiKey },
      },
      input.deadlineAtMs,
      input.fetchTimeoutMs,
      nowFn(),
    );
    const statusJson = (await readGeminiResponseOrThrow(
      statusRes,
      "Gemini file status check failed",
    )) as { state?: string };
    if (statusJson.state === "ACTIVE") {
      return;
    }
    if (statusJson.state === "FAILED") {
      throw new Error("Gemini file processing failed");
    }
  }
}

async function downloadGeminiFileMedia(input: {
  fetchFn: typeof fetch;
  apiKey: string;
  filesResource: string;
  fetchTimeoutMs: number;
  deadlineAtMs: number;
  nowFn?: () => number;
}): Promise<Buffer> {
  const resource = input.filesResource.replace(/^\//, "");
  const fileId = resource.replace(/^files\//, "");
  const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(
    fileId,
  )}:download?alt=media`;
  const nowFn = input.nowFn ?? Date.now;
  const dlRes = await fetchWithAdamVideoDeadline(
    input.fetchFn,
    downloadUrl,
    {
      method: "GET",
      headers: { "x-goog-api-key": input.apiKey },
    },
    input.deadlineAtMs,
    input.fetchTimeoutMs,
    nowFn(),
  );
  if (!dlRes.ok) {
    logGeminiHttpFailure(dlRes.status);
    throw new Error(`Gemini file download failed (${dlRes.status})`);
  }
  const ab = await dlRes.arrayBuffer();
  return Buffer.from(ab);
}

type InteractionMediaPart = {
  type?: string;
  mime_type?: string;
  mimeType?: string;
  data?: string;
  uri?: string;
};

function extractVideoFromGeminiInteraction(data: unknown): {
  videoBase64?: string;
  videoUri?: string;
  mimeType: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as {
    output_video?: { data?: string; uri?: string; mime_type?: string };
    steps?: Array<{ type?: string; content?: InteractionMediaPart[] }>;
  };

  const sdkVideo = payload.output_video;
  if (sdkVideo?.data) {
    return {
      videoBase64: sdkVideo.data,
      mimeType: sdkVideo.mime_type || "video/mp4",
    };
  }
  if (sdkVideo?.uri) {
    return {
      videoUri: sdkVideo.uri,
      mimeType: sdkVideo.mime_type || "video/mp4",
    };
  }

  if (Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      if (step.type !== "model_output" || !Array.isArray(step.content)) {
        continue;
      }
      for (const item of step.content) {
        if (item.type !== "video") continue;
        const mimeType = item.mime_type || item.mimeType || "video/mp4";
        if (item.data) {
          return { videoBase64: item.data, mimeType };
        }
        if (item.uri) {
          return { videoUri: item.uri, mimeType };
        }
      }
    }
  }

  return null;
}

export type StudioChatResponse = {
  reply: string;
  createdDraft?: {
    postId: string;
    approvalId: string;
    slug: string;
    title: string;
    teaserText: string;
    emailSubject: string;
  } | null;
  generatedBanner?: GeneratedBannerResult | null;
  provider: "gemini" | "adk" | "local-editorial";
};

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

function getGeminiModel(): string {
  return process.env.ADAM_GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `dear-creative-issue-${Date.now()}`;
}

async function ensureUniqueSlug(
  db: DearCreativeDb,
  desiredSlug: string,
): Promise<string> {
  const clean = slugifyTitle(desiredSlug);
  const existing = await findPostBySlug(db, clean);
  if (!existing) {
    return clean;
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const candidate = `${clean}-${stamp}`;
  const existingCandidate = await findPostBySlug(db, candidate);
  if (!existingCandidate) {
    return candidate;
  }
  return `${clean}-${Date.now().toString(36)}`;
}

function buildMultimodalGeminiParts(
  promptText: string,
  attachments: StudioAttachmentInput[] = [],
) {
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  for (const att of attachments) {
    if (att.textContent?.trim()) {
      parts.push({
        text: `[Attached File: ${att.name} (${att.mimeType})]\n${att.textContent.slice(0, 20000)}`,
      });
    } else if (
      att.base64Data &&
      (att.mimeType.startsWith("image/") ||
        att.mimeType === "application/pdf" ||
        att.mimeType.startsWith("audio/"))
    ) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64Data,
        },
      });
      parts.push({
        text: `[Attached media reference: ${att.name} (${att.mimeType})]`,
      });
    } else {
      parts.push({
        text: `[Attached file metadata: ${att.name} (${att.mimeType}, ${att.sizeBytes} bytes)]`,
      });
    }
  }

  parts.push({ text: promptText });
  return parts;
}

function buildLocalDraftFromSource(input: {
  titleHint?: string | null;
  rawText: string;
  attachments?: StudioAttachmentInput[];
  sponsorId?: string | null;
}): DraftProposal {
  const lines = input.rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstHeading = lines[0]?.replace(/^#+\s*/, "") ?? "Dear Creative Issue";
  const title =
    input.titleHint?.trim() ||
    (firstHeading.length > 88
      ? `${firstHeading.slice(0, 85)}...`
      : firstHeading);

  const slug = slugifyTitle(title);
  const markdownSource = input.rawText.trim().startsWith("#")
    ? input.rawText.trim()
    : `## ${title}\n\n${input.rawText.trim()}`;

  const renderedBody = renderMarkdownToSafeHtml(markdownSource);
  const attachmentNote =
    input.attachments && input.attachments.length > 0
      ? `<p><em>Reference materials analyzed: ${input.attachments
          .map((a) => a.name)
          .join(", ")}.</em></p>`
      : "";

  const fullHtml = sanitizeArticleHtml(
    `${renderedBody}\n${attachmentNote}`.trim(),
  );

  const nonHeadingLine =
    lines.find((line) => !line.startsWith("#")) ?? firstHeading;
  const plainTeaser = nonHeadingLine
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  const teaserText =
    plainTeaser.length > 200
      ? `${plainTeaser.slice(0, 197)}...`
      : plainTeaser || title;

  return {
    slug,
    title,
    teaserText,
    emailSubject: `Dear Creative: ${title}`,
    emailHtml: fullHtml,
    bodyHtml: fullHtml,
    sponsorId: input.sponsorId ?? null,
  };
}

async function generateStructuredDraftWithGemini(input: {
  prompt: string;
  attachments?: StudioAttachmentInput[];
  sponsorId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<{ reply: string; draft: DraftProposal | null } | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemInstruction = `You are Adam, the Dear Creative editorial agent for creative builders, artists, and independent founders.
Never send email or post to X directly; you only converse with the editor (using Markdown formatting when helpful) and prepare newsletter drafts for the human approval queue.
Respond strictly in valid JSON with this shape:
{
  "reply": "Your conversational response to the editor (supports Markdown).",
  "shouldCreateDraft": true or false,
  "draft": {
    "slug": "kebab-case-url-slug",
    "title": "Compelling newsletter issue title",
    "teaserText": "1-2 sentence punchy teaser for X and preview cards (under 220 chars)",
    "emailSubject": "Email subject line",
    "markdown": "Optional Markdown article body",
    "emailHtml": "<p>Rich semantic HTML article body using <p>, <h2>, <h3>, <ul>, <li>, <blockquote>, <strong>, <em></p>"
  } // null if shouldCreateDraft is false
}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: buildMultimodalGeminiParts(input.prompt, input.attachments),
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!rawText) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText) as {
      reply?: string;
      shouldCreateDraft?: boolean;
      draft?: {
        slug?: string;
        title?: string;
        teaserText?: string;
        emailSubject?: string;
        markdown?: string;
        emailHtml?: string;
      } | null;
    };

    const reply =
      parsed.reply?.trim() ||
      "I have reviewed your input and prepared a response.";

    if (parsed.shouldCreateDraft && parsed.draft?.title) {
      const sanitizedHtml = ensureArticleHtml(
        parsed.draft.emailHtml ||
          parsed.draft.markdown ||
          parsed.draft.teaserText ||
          "",
      );
      return {
        reply,
        draft: {
          slug: slugifyTitle(parsed.draft.slug || parsed.draft.title),
          title: parsed.draft.title.trim(),
          teaserText:
            parsed.draft.teaserText?.trim() || parsed.draft.title.trim(),
          emailSubject:
            parsed.draft.emailSubject?.trim() ||
            `Dear Creative: ${parsed.draft.title.trim()}`,
          emailHtml: sanitizedHtml,
          bodyHtml: sanitizedHtml,
          sponsorId: input.sponsorId ?? null,
        },
      };
    }

    return { reply, draft: null };
  } catch {
    return { reply: rawText, draft: null };
  }
}

async function persistDraftProposal(
  db: DearCreativeDb,
  proposal: DraftProposal,
): Promise<PublishDraftResult & { slug: string; title: string }> {
  const uniqueSlug = await ensureUniqueSlug(db, proposal.slug);
  try {
    const published = await publishDraftToTurso(db, {
      slug: uniqueSlug,
      title: proposal.title,
      teaserText: proposal.teaserText,
      emailSubject: proposal.emailSubject,
      emailHtml: proposal.emailHtml,
      bodyHtml: proposal.bodyHtml,
      sponsorId: proposal.sponsorId ?? null,
      dryRun: false,
    });
    return { ...published, slug: uniqueSlug, title: proposal.title };
  } catch (err) {
    if (err instanceof DuplicateSlugError) {
      const fallbackSlug = `${uniqueSlug}-${Date.now().toString(36)}`;
      const published = await publishDraftToTurso(db, {
        slug: fallbackSlug,
        title: proposal.title,
        teaserText: proposal.teaserText,
        emailSubject: proposal.emailSubject,
        emailHtml: proposal.emailHtml,
        bodyHtml: proposal.bodyHtml,
        sponsorId: proposal.sponsorId ?? null,
        dryRun: false,
      });
      return { ...published, slug: fallbackSlug, title: proposal.title };
    }
    throw err;
  }
}

export async function chatWithAdam(
  db: DearCreativeDb,
  input: {
    message: string;
    history?: StudioChatMessage[];
    attachments?: StudioAttachmentInput[];
    forceCreateDraft?: boolean;
    forceGenerateBanner?: boolean;
    fetchFn?: typeof fetch;
    uploadFn?: (
      file: File | Blob,
      fileName?: string,
    ) => Promise<LensGroveUploadResult>;
  },
): Promise<StudioChatResponse> {
  const sponsors = await fetchActiveSponsors(db);
  const defaultSponsorId = sponsors[0]?.id ?? null;

  const historyContext = (input.history ?? [])
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Editor" : "Adam"}: ${m.content}`)
    .join("\n\n");

  const wantsDraft =
    Boolean(input.forceCreateDraft) ||
    /\b(draft|turn this into a post|create a post|publish to queue|write an issue|make a post)\b/i.test(
      input.message,
    );

  const wantsBanner =
    Boolean(input.forceGenerateBanner) ||
    /\b(generate|create|make|design|render|paint|draw)\b[\s\S]{0,48}\b(banner|cover\s*image|hero\s*image|thumbnail|header\s*image|artwork|image\s*for)\b/i.test(
      input.message,
    );

  let generatedBanner: GeneratedBannerResult | null = null;
  if (wantsBanner) {
    try {
      generatedBanner = await generateBannerWithGemini({
        prompt: input.message,
        title: input.message.slice(0, 72),
        fetchFn: input.fetchFn,
        uploadFn: input.uploadFn,
      });
    } catch {
      generatedBanner = null;
    }
  }

  const prompt = [
    historyContext ? `Conversation history:\n${historyContext}` : "",
    `Current Editor Request:\n${input.message}`,
    generatedBanner
      ? `A banner image was just generated and uploaded to Lens Grove at ${generatedBanner.url} (URI: ${generatedBanner.uri}). Mention it in your reply.`
      : "",
    wantsDraft
      ? "The editor wants you to create a newsletter draft now. Set shouldCreateDraft=true and provide a complete draft object."
      : "If the editor is asking you to draft a post or newsletter issue, set shouldCreateDraft=true and include the draft object; otherwise set shouldCreateDraft=false.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const geminiResult = await generateStructuredDraftWithGemini({
    prompt,
    attachments: input.attachments,
    sponsorId: defaultSponsorId,
    fetchFn: input.fetchFn,
  });

  if (geminiResult) {
    const bannerAppend =
      generatedBanner && !geminiResult.reply.includes(generatedBanner.url)
        ? `\n\n![Generated Banner](${generatedBanner.url})\n*Uploaded to Lens Grove:* \`${generatedBanner.uri}\``
        : "";
    if (geminiResult.draft) {
      if (generatedBanner) {
        geminiResult.draft.bodyHtml = replaceBannerInHtml(
          geminiResult.draft.bodyHtml,
          generatedBanner.url,
          geminiResult.draft.title,
        );
        geminiResult.draft.emailHtml = replaceBannerInHtml(
          geminiResult.draft.emailHtml,
          generatedBanner.url,
          geminiResult.draft.title,
        );
      }
      const saved = await persistDraftProposal(db, geminiResult.draft);
      return {
        reply: `${geminiResult.reply}${bannerAppend}`,
        createdDraft: {
          postId: saved.postId,
          approvalId: saved.approvalId,
          slug: saved.slug,
          title: geminiResult.draft.title,
          teaserText: geminiResult.draft.teaserText,
          emailSubject: geminiResult.draft.emailSubject,
        },
        generatedBanner,
        provider: "gemini",
      };
    }
    return {
      reply: `${geminiResult.reply}${bannerAppend}`,
      createdDraft: null,
      generatedBanner,
      provider: "gemini",
    };
  }

  // Deterministic local editorial assistant fallback when GEMINI_API_KEY is not set
  if (wantsDraft) {
    const proposal = buildLocalDraftFromSource({
      rawText: input.message,
      attachments: input.attachments,
      sponsorId: defaultSponsorId,
    });
    if (generatedBanner) {
      proposal.bodyHtml = replaceBannerInHtml(
        proposal.bodyHtml,
        generatedBanner.url,
        proposal.title,
      );
      proposal.emailHtml = replaceBannerInHtml(
        proposal.emailHtml,
        generatedBanner.url,
        proposal.title,
      );
    }
    const saved = await persistDraftProposal(db, proposal);
    const bannerMarkdown = generatedBanner
      ? `\n\n![Generated Banner](${generatedBanner.url})\n*Lens Grove URI:* \`${generatedBanner.uri}\``
      : "";
    return {
      reply: `I turned your note into a draft issue titled "${proposal.title}" (slug: \`${saved.slug}\`) and placed it in the Approval Queue for your review.${bannerMarkdown}`,
      createdDraft: {
        postId: saved.postId,
        approvalId: saved.approvalId,
        slug: saved.slug,
        title: proposal.title,
        teaserText: proposal.teaserText,
        emailSubject: proposal.emailSubject,
      },
      generatedBanner,
      provider: "local-editorial",
    };
  }

  if (generatedBanner) {
    return {
      reply: `I generated a new banner for your issue and uploaded it to Lens Grove Storage:\n\n![Generated Banner](${generatedBanner.url})\n\n- **Gateway URL:** \`${generatedBanner.url}\`\n- **Lens Grove URI:** \`${generatedBanner.uri}\`\n\nYou can apply it directly in the **Posts** tab or ask me to draft an issue with it.`,
      createdDraft: null,
      generatedBanner,
      provider: "local-editorial",
    };
  }

  const attachmentSummary =
    input.attachments && input.attachments.length > 0
      ? ` I also received ${input.attachments.length} reference file(s): ${input.attachments
          .map((a) => a.name)
          .join(", ")}.`
      : "";

  return {
    reply: `Got it — I'm reviewing your notes: "${input.message.slice(0, 140)}${
      input.message.length > 140 ? "..." : ""
    }".${attachmentSummary} Let me know when you'd like me to turn this into a post for the Approval Queue, or click "Draft Issue from Chat".`,
    createdDraft: null,
    generatedBanner: null,
    provider: "local-editorial",
  };
}

export async function turnIdeaIntoDraft(
  db: DearCreativeDb,
  input: {
    ideaId?: string;
    title?: string | null;
    rawContent?: string;
    attachments?: StudioAttachmentInput[];
    actor?: string;
    fetchFn?: typeof fetch;
  },
): Promise<{
  idea: AdamIdeaRecord;
  draft: {
    postId: string;
    approvalId: string;
    slug: string;
    title: string;
    teaserText: string;
    emailSubject: string;
  };
  reply: string;
  provider: "gemini" | "local-editorial";
}> {
  let idea: AdamIdeaRecord | null = null;
  if (input.ideaId) {
    idea = await getAdamIdeaById(db, input.ideaId);
    if (!idea) {
      throw new Error("Idea not found");
    }
  } else {
    const rawContent = input.rawContent?.trim() ?? "";
    if (!rawContent) {
      throw new Error("Idea or rough draft content is required");
    }
    const meta: IdeaAttachmentMeta[] = (input.attachments ?? []).map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      textExcerpt: a.textContent?.slice(0, 300),
    }));
    idea = await createAdamIdea(db, {
      title: input.title,
      rawContent,
      attachments: meta,
      createdBy: input.actor ?? "admin",
    });
  }

  const sponsors = await fetchActiveSponsors(db);
  const defaultSponsorId = sponsors[0]?.id ?? null;

  const prompt = `Turn the following Dear Creative idea / rough draft into a polished newsletter post for human approval.
Title hint: ${idea.title}
Rough Draft / Idea Notes:
${idea.rawContent}

Set shouldCreateDraft=true and return a complete draft object with a compelling title, kebab-case slug, concise teaserText, emailSubject, and well-structured semantic emailHtml.`;

  const geminiResult = await generateStructuredDraftWithGemini({
    prompt,
    attachments: input.attachments,
    sponsorId: defaultSponsorId,
    fetchFn: input.fetchFn,
  });

  const proposal =
    geminiResult?.draft ??
    buildLocalDraftFromSource({
      titleHint: idea.title,
      rawText: idea.rawContent,
      attachments: input.attachments,
      sponsorId: defaultSponsorId,
    });

  const saved = await persistDraftProposal(db, proposal);
  const updatedIdea =
    (await markAdamIdeaDrafted(
      db,
      idea.id,
      saved.postId,
      input.actor ?? "adam",
    )) ?? idea;

  return {
    idea: updatedIdea,
    draft: {
      postId: saved.postId,
      approvalId: saved.approvalId,
      slug: saved.slug,
      title: proposal.title,
      teaserText: proposal.teaserText,
      emailSubject: proposal.emailSubject,
    },
    reply:
      geminiResult?.reply ??
      `Drafted "${proposal.title}" into the Approval Queue from your idea.`,
    provider: geminiResult?.draft ? "gemini" : "local-editorial",
  };
}

export async function runScheduledIssueDraft(
  db: DearCreativeDb,
  options: {
    force?: boolean;
    actor?: string;
    fetchFn?: typeof fetch;
    now?: Date;
  } = {},
): Promise<{
  outcome: "drafted_from_idea" | "drafted_autonomous" | "skipped_disabled";
  schedule: AdamScheduleRecord;
  ideaUsed?: AdamIdeaRecord | null;
  draft?: {
    postId: string;
    approvalId: string;
    slug: string;
    title: string;
  } | null;
}> {
  const schedule = await getOrCreateAdamSchedule(db);
  if (!schedule.enabled && !options.force) {
    const updated = await recordAdamScheduleRun(db, {
      status: "skipped",
      message: "Scheduled run skipped because schedule is disabled.",
      now: options.now,
    });
    return {
      outcome: "skipped_disabled",
      schedule: updated,
      ideaUsed: null,
      draft: null,
    };
  }

  // 1. Check queued ideas first (oldest queued first)
  const queuedIdeas = await listAdamIdeas(db, {
    status: "queued",
    oldestFirst: true,
  });

  if (queuedIdeas.length > 0) {
    const topIdea = queuedIdeas[0]!;
    const result = await turnIdeaIntoDraft(db, {
      ideaId: topIdea.id,
      actor: options.actor ?? "adam-scheduler",
      fetchFn: options.fetchFn,
    });

    const updatedSchedule = await recordAdamScheduleRun(db, {
      status: "success",
      message: `Drafted "${result.draft.title}" from queued idea "${topIdea.title}".`,
      draftPostId: result.draft.postId,
      now: options.now,
    });

    return {
      outcome: "drafted_from_idea",
      schedule: updatedSchedule,
      ideaUsed: result.idea,
      draft: result.draft,
    };
  }

  // 2. Fallback: Autonomous issue generation when idea queue is empty
  const recentPosts = await db
    .select({ title: posts.title, slug: posts.slug })
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(5);
  const recentTitles = recentPosts.map((p) => `- ${p.title}`).join("\n");

  const sponsors = await fetchActiveSponsors(db);
  const defaultSponsorId = sponsors[0]?.id ?? null;
  const dateLabel = (options.now ?? new Date()).toISOString().slice(0, 10);

  const sentimentReport = await getRecentFeedbackSummaryForEditorial(db, 14);

  const autonomousPrompt = `You are drafting the scheduled Dear Creative weekly issue for ${dateLabel}.
Editorial instructions: ${
    schedule.instructions ||
    "Write a thoughtful, actionable Dear Creative issue for independent creators and creative technologists."
  }

${sentimentReport.summaryPromptText}

Recent issues to avoid repeating:
${recentTitles || "(No recent issues)"}

Set shouldCreateDraft=true and generate a fresh, original Dear Creative newsletter issue for human approval.`;

  const geminiResult = await generateStructuredDraftWithGemini({
    prompt: autonomousPrompt,
    sponsorId: defaultSponsorId,
    fetchFn: options.fetchFn,
  });

  const proposal =
    geminiResult?.draft ??
    buildLocalDraftFromSource({
      titleHint: `Creative Pulse — Weekly Dispatch (${dateLabel})`,
      rawText: [
        `# Creative Pulse — Weekly Dispatch (${dateLabel})`,
        "Welcome back to Dear Creative. This week we are exploring how independent creators and builders turn rough sparks into durable creative workflows.",
        schedule.instructions
          ? `Editorial focus: ${schedule.instructions}`
          : "Key takeaway: own your audience, ship consistently, and keep human taste at the center of every tool you adopt.",
      ].join("\n\n"),
      sponsorId: defaultSponsorId,
    });

  const saved = await persistDraftProposal(db, proposal);
  const updatedSchedule = await recordAdamScheduleRun(db, {
    status: "success",
    message: `Autonomously drafted "${proposal.title}" (no queued ideas in backlog).`,
    draftPostId: saved.postId,
    now: options.now,
  });

  return {
    outcome: "drafted_autonomous",
    schedule: updatedSchedule,
    ideaUsed: null,
    draft: {
      postId: saved.postId,
      approvalId: saved.approvalId,
      slug: saved.slug,
      title: proposal.title,
    },
  };
}

/**
 * Wraps raw 16-bit signed little-endian mono PCM (e.g. Gemini 24kHz audio/L16)
 * into a standard RIFF WAV buffer so browsers can play it natively.
 */
export function pcm16ToWavBuffer(
  pcmBase64: string,
  sampleRate = 24000,
  numChannels = 1,
): Buffer {
  const pcmData = Buffer.from(pcmBase64, "base64");
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([wavHeader, pcmData]);
}

export async function transcribeAudioWithGemini(input: {
  audioBase64: string;
  mimeType: string;
  fetchFn?: typeof fetch;
}): Promise<{ text: string; provider: "gemini-stt" }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server; use browser Web Speech fallback.",
    );
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: input.mimeType || "audio/webm",
                data: input.audioBase64,
              },
            },
            {
              text: "Transcribe the spoken audio accurately into plain text. Return only the transcription without extra commentary.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini STT request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const transcript =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  return { text: transcript, provider: "gemini-stt" };
}

function extractAudioFromGeminiResponse(data: unknown): {
  audioBase64: string;
  mimeType: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as {
    output_audio?: { data?: string };
    steps?: Array<{
      type?: string;
      content?: Array<{ type?: string; data?: string }>;
    }>;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  let rawAudio: string | undefined = payload.output_audio?.data;
  if (!rawAudio && Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item.type === "audio" && item.data) {
            rawAudio = item.data;
            break;
          }
        }
      }
      if (rawAudio) break;
    }
  }

  if (!rawAudio) {
    const inline = payload.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (inline?.data) {
      rawAudio = inline.data;
    }
  }

  if (!rawAudio) return null;

  const buf = Buffer.from(rawAudio, "base64");
  const isWav =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE";

  if (isWav) {
    return {
      audioBase64: rawAudio,
      mimeType: "audio/wav",
    };
  }

  const wav = pcm16ToWavBuffer(rawAudio, 24000, 1);
  return {
    audioBase64: wav.toString("base64"),
    mimeType: "audio/wav",
  };
}

export async function synthesizeSpeechWithGoogle(input: {
  text: string;
  voiceName?: string;
  fetchFn?: typeof fetch;
}): Promise<{
  audioBase64: string;
  mimeType: string;
  provider: "gemini-tts" | "google-cloud-tts";
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server; use browser speechSynthesis fallback.",
    );
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const cleanText = input.text.trim().slice(0, 10000);
  if (!cleanText) {
    throw new Error("Text is required for speech synthesis");
  }

  // 1. Try Gemini 3.8 Flash TTS via Interactions API (default)
  const ttsModel =
    process.env.ADAM_GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
  const voiceName = input.voiceName?.trim() || "Puck";

  const isInteractionsModel =
    ttsModel.startsWith("gemini-3.8") ||
    (ttsModel.includes("tts") && !ttsModel.includes("preview"));

  if (isInteractionsModel) {
    const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
      apiKey,
    )}`;
    try {
      const interactionsRes = await fetchImpl(interactionsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ttsModel,
          input: [
            {
              type: "user_input",
              content: [{ type: "text", text: cleanText }],
            },
          ],
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [{ voice: voiceName }],
          },
        }),
      });

      if (interactionsRes.ok) {
        const json = await interactionsRes.json();
        const extracted = extractAudioFromGeminiResponse(json);
        if (extracted) {
          return {
            ...extracted,
            provider: "gemini-tts",
          };
        }
      }
    } catch {
      // Fall through to generateContent
    }
  }

  // 2. Try generateContent endpoint (for gemini-2.5-flash-preview-tts or fallback)
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    ttsModel,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const geminiRes = await fetchImpl(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: cleanText }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      }),
    });

    if (geminiRes.ok) {
      const geminiData = await geminiRes.json();
      const extracted = extractAudioFromGeminiResponse(geminiData);
      if (extracted) {
        return {
          ...extracted,
          provider: "gemini-tts",
        };
      }
    }
  } catch {
    // Fall through to Cloud TTS
  }

  // 3. Fallback to Google Cloud Text-to-Speech v1 REST endpoint
  const cloudTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(
    apiKey,
  )}`;
  const isAoede = voiceName.toLowerCase() === "aoede";
  const cloudVoiceName = isAoede ? "en-US-Journey-F" : "en-US-Journey-D";
  const cloudSsmlGender = isAoede ? "FEMALE" : "MALE";

  const cloudRes = await fetchImpl(cloudTtsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: cleanText.slice(0, 5000) },
      voice: {
        languageCode: "en-US",
        name: cloudVoiceName,
        ssmlGender: cloudSsmlGender,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    }),
  });

  if (!cloudRes.ok) {
    throw new Error(`Google TTS request failed (${cloudRes.status})`);
  }

  const cloudData = (await cloudRes.json()) as { audioContent?: string };
  if (!cloudData.audioContent) {
    throw new Error("Empty audioContent from Google Cloud TTS");
  }

  return {
    audioBase64: cloudData.audioContent,
    mimeType: "audio/mp3",
    provider: "google-cloud-tts",
  };
}

function extractImageFromGeminiResponse(data: unknown): {
  imageBase64: string;
  mimeType: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as {
    output_image?: { data?: string; mime_type?: string };
    predictions?: Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
    }>;
    steps?: Array<{ type?: string; content?: InteractionMediaPart[] }>;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  if (payload.output_image?.data) {
    return {
      imageBase64: payload.output_image.data,
      mimeType: payload.output_image.mime_type || "image/png",
    };
  }

  if (Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      if (step.type !== "model_output" || !Array.isArray(step.content)) {
        continue;
      }
      for (const item of step.content) {
        if (item.type === "image" && item.data) {
          return {
            imageBase64: item.data,
            mimeType: item.mime_type || item.mimeType || "image/png",
          };
        }
      }
    }
  }

  const pred = payload.predictions?.[0];
  if (pred?.bytesBase64Encoded) {
    return {
      imageBase64: pred.bytesBase64Encoded,
      mimeType: pred.mimeType || "image/png",
    };
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (
      part.inlineData?.data &&
      (!part.inlineData.mimeType ||
        part.inlineData.mimeType.startsWith("image/"))
    ) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  return null;
}

export async function generateBannerWithGemini(input: {
  prompt?: string | null;
  title?: string | null;
  teaserText?: string | null;
  slug?: string | null;
  aspectRatio?: "16:9" | "1:1" | "21:9";
  fetchTimeoutMs?: number;
  fetchFn?: typeof fetch;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
  ) => Promise<LensGroveUploadResult>;
}): Promise<GeneratedBannerResult> {
  const title = input.title?.trim() || "Dear Creative Dispatch";
  const slug = slugifyTitle(input.slug?.trim() || title);
  const aspectRatio = input.aspectRatio || "16:9";
  const customPrompt = input.prompt?.trim() || "";

  const effectivePrompt = customPrompt
    ? `Create an editorial banner artwork for the creative publication "Dear Creative". Aspect ratio ${aspectRatio}. Visual brief: ${customPrompt}. Title context: "${title}". High contrast, clean modern composition, vibrant creative technology aesthetic.`
    : `Create a striking widescreen editorial cover artwork (${aspectRatio}) for the publication "Dear Creative" issue titled "${title}"${
        input.teaserText ? ` — ${input.teaserText.trim()}` : ""
      }. Modern independent creator aesthetic, bold geometric lighting, rich editorial illustration.`;

  const apiKey = getGeminiApiKey();
  const fetchImpl = input.fetchFn ?? fetch;
  const uploadImpl = input.uploadFn ?? uploadToLensGrove;

  let imageBytes: Buffer | null = null;
  let mimeType = "image/png";
  let provider: "gemini-image" | "nano-banana" | "deterministic-svg" =
    "deterministic-svg";

  if (apiKey) {
    // 1. Try Gemini Native Image Generation (gemini-2.5-flash-image / ADAM_GEMINI_IMAGE_MODEL)
    const imageModel =
      process.env.ADAM_GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
    const geminiImageUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      imageModel,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const geminiRes = await fetchImpl(geminiImageUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: effectivePrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const extracted = extractImageFromGeminiResponse(json);
        if (extracted) {
          imageBytes = Buffer.from(extracted.imageBase64, "base64");
          mimeType = extracted.mimeType;
          provider = "gemini-image";
        }
      }
    } catch {
      // Fall through to Nano Banana fallback
    }

    // 2. Fallback to Nano Banana 2.1 (Interactions API)
    if (!imageBytes) {
      const imageModel = resolveAdamImageFallbackModel();
      const interactionsUrl = geminiInteractionsUrl();
      const bannerAspect =
        aspectRatio === "21:9" ? "16:9" : aspectRatio;
      const imageFetchTimeoutMs =
        input.fetchTimeoutMs ?? ADAM_VIDEO_DEFAULT_FETCH_TIMEOUT_MS;

      try {
        const imageRes = await fetchWithPerRequestTimeout(
          fetchImpl,
          interactionsUrl,
          {
            method: "POST",
            headers: geminiApiKeyHeaders(apiKey),
            body: JSON.stringify({
              model: imageModel,
              input: [{ type: "text", text: effectivePrompt }],
              response_format: {
                type: "image",
                mime_type: "image/png",
                aspect_ratio: bannerAspect,
              },
            }),
          },
          imageFetchTimeoutMs,
        );
        const json = await readGeminiResponseOrThrow(
          imageRes,
          "Gemini image interaction failed",
        );
        assertGeminiInteractionCompleted(json);
        const extracted = extractImageFromGeminiResponse(json);
        if (extracted) {
          imageBytes = Buffer.from(extracted.imageBase64, "base64");
          mimeType = extracted.mimeType;
          provider = "nano-banana";
        }
      } catch {
        // Fall through to deterministic SVG banner
      }
    }
  }

  // 3. Deterministic SVG fallback when no API key or upstream image model unavailable
  if (!imageBytes) {
    const svg = generateDeterministicBannerSvg({
      title,
      slug: customPrompt ? `${slug}-${slugifyTitle(customPrompt)}` : slug,
    });
    imageBytes = Buffer.from(svg, "utf-8");
    mimeType = "image/svg+xml";
    provider = "deterministic-svg";
  }

  const ext =
    mimeType === "image/svg+xml"
      ? "svg"
      : mimeType === "image/jpeg"
        ? "jpg"
        : mimeType === "image/webp"
          ? "webp"
          : "png";
  const fileName = `${slug}-banner.${ext}`;
  const blob = new Blob([new Uint8Array(imageBytes)], { type: mimeType });

  try {
    const uploaded = await uploadImpl(blob, fileName);
    return {
      url: uploaded.gatewayUrl,
      uri: uploaded.uri,
      storageKey: uploaded.storageKey,
      mimeType,
      promptUsed: effectivePrompt,
      provider,
    };
  } catch {
    // Offline fallback: return data URL so local dev/tests still succeed
    const fallbackUrl =
      mimeType === "image/svg+xml"
        ? `data:image/svg+xml;utf8,${encodeURIComponent(imageBytes.toString("utf-8"))}`
        : `data:${mimeType};base64,${imageBytes.toString("base64")}`;
    const localKey = `local-${slug}-${Date.now().toString(36)}`;
    return {
      url: fallbackUrl,
      uri: `lens://${localKey}`,
      storageKey: localKey,
      mimeType,
      promptUsed: effectivePrompt,
      provider,
    };
  }
}

export async function generateVideoWithVeo(input: {
  prompt: string;
  title?: string | null;
  slug?: string | null;
  aspectRatio?: "16:9" | "9:16";
  imageBase64?: string | null;
  imageMimeType?: string | null;
  pollIntervalMs?: number;
  fetchTimeoutMs?: number;
  wallBudgetMs?: number;
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
    signal?: AbortSignal,
  ) => Promise<LensGroveUploadResult>;
}): Promise<GeneratedVideoResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server; use the Google Colab Asset Notebook or upload an MP4 directly.",
    );
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const uploadImpl = input.uploadFn ?? uploadToLensGrove;
  const title = input.title?.trim() || "Dear Creative Dispatch";
  const slug = slugifyTitle(input.slug?.trim() || title);
  const aspectRatio = input.aspectRatio || "16:9";
  const promptText = input.prompt.trim();
  if (!promptText) {
    throw new Error("A video prompt is required for Veo generation.");
  }

  const videoModel = resolveAdamGeminiVideoModel();
  const fetchTimeoutMs =
    input.fetchTimeoutMs ?? ADAM_VIDEO_DEFAULT_FETCH_TIMEOUT_MS;
  const pollInterval =
    input.pollIntervalMs ?? ADAM_VIDEO_DEFAULT_POLL_INTERVAL_MS;
  const nowFn = input.nowFn ?? Date.now;
  const sleepFn =
    input.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const deadlineAtMs = createAdamVideoDeadline(
    input.wallBudgetMs ?? ADAM_VIDEO_ROUTE_BUDGET_MS,
    nowFn(),
  );

  let videoBytes: Buffer | null = null;
  let videoProvider: GeneratedVideoResult["provider"] = "gemini-omni";

  if (usesLegacyVeoPredictApi(videoModel)) {
    videoProvider = "veo";
    const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      videoModel,
    )}:predictLongRunning?key=${encodeURIComponent(apiKey)}`;

    const instancePayload: Record<string, unknown> = { prompt: promptText };
    if (input.imageBase64) {
      instancePayload.image = {
        bytesBase64Encoded: input.imageBase64,
        mimeType: input.imageMimeType || "image/png",
      };
    }

    const startRes = await fetchImpl(startUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [instancePayload],
        parameters: {
          aspectRatio,
          sampleCount: 1,
        },
      }),
    });

    if (!startRes.ok) {
      throw new Error(
        `Veo video generation request failed (${startRes.status})`,
      );
    }

    type VeoOperationPayload = {
      name?: string;
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{
            video?: {
              uri?: string;
              bytesBase64Encoded?: string;
              mimeType?: string;
            };
          }>;
        };
        predictions?: Array<{
          bytesBase64Encoded?: string;
          video?: { uri?: string; bytesBase64Encoded?: string };
        }>;
      };
    };

    let opData = (await startRes.json()) as VeoOperationPayload;
    let veoPolledBefore = false;
    while (!opData.done && opData.name) {
      throwIfAdamVideoDeadlineExceeded(deadlineAtMs, nowFn());
      if (veoPolledBefore && pollInterval > 0) {
        const nowBeforeSleep = nowFn();
        const fetchTimeoutBeforePoll = Math.min(
          fetchTimeoutMs,
          remainingAdamVideoBudgetMs(deadlineAtMs, nowBeforeSleep),
        );
        if (
          nowBeforeSleep + pollInterval + fetchTimeoutBeforePoll >
          deadlineAtMs
        ) {
          throw new Error(ADAM_VIDEO_WALL_TIMEOUT_MESSAGE);
        }
        await sleepFn(pollInterval);
      }
      veoPolledBefore = true;

      const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${opData.name.replace(
        /^\//,
        "",
      )}?key=${encodeURIComponent(apiKey)}`;
      const pollRes = await fetchWithAdamVideoDeadline(
        fetchImpl,
        pollUrl,
        { method: "GET" },
        deadlineAtMs,
        fetchTimeoutMs,
        nowFn(),
      );
      if (!pollRes.ok) {
        throw new Error(`Veo operation polling failed (${pollRes.status})`);
      }
      opData = (await pollRes.json()) as VeoOperationPayload;
    }

    if (opData.error?.message) {
      throw new Error(`Veo error: ${opData.error.message}`);
    }

    const sample =
      opData.response?.generateVideoResponse?.generatedSamples?.[0]?.video ??
      opData.response?.predictions?.[0]?.video ??
      opData.response?.predictions?.[0];

    if (sample && "bytesBase64Encoded" in sample && sample.bytesBase64Encoded) {
      videoBytes = Buffer.from(sample.bytesBase64Encoded, "base64");
    } else if (sample && "uri" in sample && sample.uri) {
      const dlUrl = sample.uri.includes("?")
        ? `${sample.uri}&key=${encodeURIComponent(apiKey)}`
        : `${sample.uri}?key=${encodeURIComponent(apiKey)}`;
      const dlRes = await fetchImpl(dlUrl);
      if (dlRes.ok) {
        const ab = await dlRes.arrayBuffer();
        videoBytes = Buffer.from(ab);
      }
    }
  } else {
    const interactionsUrl = geminiInteractionsUrl();
    const interactionInput: Array<Record<string, string>> = input.imageBase64
      ? [
          {
            type: "image",
            data: input.imageBase64,
            mime_type: input.imageMimeType || "image/png",
          },
          { type: "text", text: promptText },
        ]
      : [{ type: "text", text: promptText }];

    const startRes = await fetchWithAdamVideoDeadline(
      fetchImpl,
      interactionsUrl,
      {
        method: "POST",
        headers: geminiApiKeyHeaders(apiKey),
        body: JSON.stringify({
          model: videoModel,
          input: interactionInput,
          response_format: {
            type: "video",
            aspect_ratio: aspectRatio,
            delivery: "uri",
          },
        }),
      },
      deadlineAtMs,
      fetchTimeoutMs,
      nowFn(),
    );

    const interactionJson = await readGeminiResponseOrThrow(
      startRes,
      "Gemini Omni video generation request failed",
    );
    assertGeminiInteractionCompleted(interactionJson);
    const extracted = extractVideoFromGeminiInteraction(interactionJson);

    if (!extracted?.videoBase64 && !extracted?.videoUri) {
      throw new Error(
        "Gemini Omni interaction did not return video output; try again or use the Colab notebook.",
      );
    }

    if (extracted.videoBase64) {
      videoBytes = Buffer.from(extracted.videoBase64, "base64");
    } else if (extracted.videoUri) {
      const filesResource = parseGeminiFilesResourceFromUri(extracted.videoUri);
      if (filesResource) {
        await pollGeminiFileUntilActive({
          fetchFn: fetchImpl,
          apiKey,
          filesResource,
          pollIntervalMs: pollInterval,
          fetchTimeoutMs,
          deadlineAtMs,
          nowFn,
          sleepFn,
        });
        videoBytes = await downloadGeminiFileMedia({
          fetchFn: fetchImpl,
          apiKey,
          filesResource,
          fetchTimeoutMs,
          deadlineAtMs,
          nowFn,
        });
      } else {
        const dlRes = await fetchWithAdamVideoDeadline(
          fetchImpl,
          extracted.videoUri,
          {
            method: "GET",
            headers: { "x-goog-api-key": apiKey },
          },
          deadlineAtMs,
          fetchTimeoutMs,
          nowFn(),
        );
        if (!dlRes.ok) {
          logGeminiHttpFailure(dlRes.status);
          throw new Error(`Gemini video download failed (${dlRes.status})`);
        }
        videoBytes = Buffer.from(await dlRes.arrayBuffer());
      }
    }
  }

  if (!videoBytes) {
    throw new Error(
      "Video generation did not return bytes yet; try running in the Google Colab Asset Notebook for longer renders.",
    );
  }

  const fileName = `${slug}-video.mp4`;
  const videoBlob = new Blob([new Uint8Array(videoBytes)], {
    type: "video/mp4",
  });
  const uploaded = await uploadVideoWithAdamDeadline(
    uploadImpl,
    videoBlob,
    fileName,
    deadlineAtMs,
    fetchTimeoutMs,
    nowFn(),
  );
  const gatewayUrlWithExt = uploaded.gatewayUrl.includes("?")
    ? `${uploaded.gatewayUrl}&ext=mp4`
    : `${uploaded.gatewayUrl}?ext=mp4`;

  return {
    url: gatewayUrlWithExt,
    uri: uploaded.uri,
    storageKey: uploaded.storageKey,
    mimeType: "video/mp4",
    promptUsed: promptText,
    provider: videoProvider,
  };
}
