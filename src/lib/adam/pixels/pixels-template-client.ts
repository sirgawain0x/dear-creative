/**
 * Pixels template client for Dear Creative branded social clips.
 */

import { randomUUID } from "node:crypto";
import type { DearCreativeDb } from "@/db/client";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import {
  loadPixelsPostDataFromDb,
  type PixelsPostData,
} from "./post-data";
import { fetchRenderArtifactBytes } from "./render-artifact";

// ============================================================================
// Types
// ============================================================================

export type PostData = PixelsPostData;

export interface GeneratedClip {
  url: string;
  uri: string;
  storageKey: string;
  durationSeconds?: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  container: string;
}

export interface DearCreativeClipsResult {
  reel9x16: GeneratedClip;
  short16x9: GeneratedClip;
  thumbnail1x1: GeneratedClip;
}

export interface PixelsProject {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  duration: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  timeline: {
    masterBusDb: number;
    tracks: PixelsTrack[];
    items: PixelsItem[];
    transitions: PixelsTransition[];
    keyframes: PixelsKeyframe[];
    compositions: unknown[];
  };
}

export interface PixelsTrack {
  id: string;
  name: string;
  kind: 'video' | 'audio';
  height: number;
  locked: boolean;
  syncLock: boolean;
  visible: boolean;
  muted: boolean;
  solo: boolean;
  order: number;
  items: string[];
}

export interface PixelsItem {
  id: string;
  type: 'text' | 'video' | 'audio';
  trackId: string;
  from: number;
  durationInFrames: number;
  label?: string;
  text?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  mediaId?: string;
  src?: string;
  volume?: number;
  sourceStart?: number;
  sourceEnd?: number;
  sourceDuration?: number;
  sourceFps?: number;
  speed?: number;
  transform?: Record<string, unknown>;
  effects?: PixelsEffect[];
}

export interface PixelsTransition {
  id: string;
  leftClipId: string;
  rightClipId: string;
  type: string;
  durationInFrames: number;
  presentation?: string;
  alignment?: number;
  properties?: Record<string, unknown>;
}

export interface PixelsKeyframe {
  itemId: string;
  property: string;
  keyframes: Array<{
    frame: number;
    value: number;
    easing?: string;
    easingConfig?: Record<string, unknown>;
  }>;
}

export interface PixelsEffect {
  id: string;
  type: 'gpu-effect';
  gpuEffectType: string;
  params: Record<string, unknown>;
}

export interface PixelsRenderRequest {
  project: string;
  codec?: 'h264' | 'h265' | 'vp9' | 'vp8' | 'av1';
  container?: 'mp4' | 'webm' | 'mov' | 'mkv' | 'mp3' | 'wav' | 'm4a';
  resolution?: string;
  fps?: number;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  inSec?: number;
  outSec?: number;
  duration?: number;
  audioOnly?: boolean;
  outputPath?: string;
}

export interface PixelsRenderResponse {
  ok: boolean;
  outputPath?: string;
  outputUrl?: string;
  downloadUrl?: string;
  url?: string;
  outputBase64?: string;
  fileSize?: number;
  warnings?: unknown[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH_9_16 = 1080;
const DEFAULT_HEIGHT_9_16 = 1920;
const DEFAULT_WIDTH_16_9 = 1920;
const DEFAULT_HEIGHT_16_9 = 1080;
const DEFAULT_WIDTH_1_1 = 1080;
const DEFAULT_HEIGHT_1_1 = 1080;

const BRANDING = {
  colors: {
    background: "#0a0a12",
    textPrimary: "#ffffff",
    textSecondary: "#b8c5d6",
    accent: "#e94560",
  },
  logoText: "Dear Creative",
  typography: {
    sizes: {
      title: 72,
      teaser: 36,
      quote: 42,
      cta: 28,
      meta: 20,
    },
  },
};

function resolveGroveUrl(urlOrUri: string | null | undefined): string {
  if (!urlOrUri) return '';
  const trimmed = urlOrUri.trim();
  if (trimmed.startsWith('lens://')) {
    const key = trimmed.slice('lens://'.length);
    return `https://api.grove.storage/${key}`;
  }
  if (trimmed.startsWith('ipfs://')) {
    const cid = trimmed.slice('ipfs://'.length).replace(/^ipfs\//, '');
    return `https://api.grove.storage/${cid}`;
  }
  return trimmed;
}

// ============================================================================
// Pixels HTTP Client
// ============================================================================

export class PixelsHttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: T;
    try {
      data = text ? JSON.parse(text) : ({} as T);
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    if (!response.ok) {
      const error = data as { error?: string; code?: string; message?: string };
      throw new Error(
        `Pixels API error (${response.status}): ${error.error ?? error.message ?? error.code ?? 'Unknown error'}`
      );
    }

    return data;
  }

  async createProject(project: Partial<PixelsProject>): Promise<PixelsProject> {
    return this.request<PixelsProject>('POST', '/v1/projects', project, {
      'Idempotency-Key': `create-${randomUUID()}`,
    });
  }

  async getProject(projectId: string): Promise<PixelsProject> {
    return this.request<PixelsProject>('GET', `/v1/projects/${encodeURIComponent(projectId)}`);
  }

  async editProject(
    projectId: string,
    ops: Array<Record<string, unknown>>,
    persist = true
  ): Promise<PixelsProject> {
    return this.request<PixelsProject>(
      'POST',
      `/v1/projects/${encodeURIComponent(projectId)}/edit`,
      { ops, persist },
      persist ? { 'Idempotency-Key': `edit-${randomUUID()}` } : {}
    );
  }

  async renderProject(request: PixelsRenderRequest): Promise<PixelsRenderResponse> {
    return this.request<PixelsRenderResponse>("POST", "/v1/render", request);
  }

  async importMediaFromUrl(
    url: string,
    mediaId?: string
  ): Promise<{ id: string; metadata: Record<string, unknown> }> {
    return this.request<{ id: string; metadata: Record<string, unknown> }>(
      'POST',
      '/v1/media/import-url',
      { url, id: mediaId }
    );
  }
}

// ============================================================================
// Project Builders
// ============================================================================

function createBaseProject(
  id: string,
  name: string,
  width: number,
  height: number,
  durationSeconds: number
): PixelsProject {
  const now = Date.now();
  return {
    id,
    name,
    description: `Dear Creative clip: ${name}`,
    width,
    height,
    fps: DEFAULT_FPS,
    backgroundColor: BRANDING.colors.background,
    duration: durationSeconds,
    schemaVersion: 10,
    createdAt: now,
    updatedAt: now,
    timeline: {
      masterBusDb: 0,
      tracks: [],
      items: [],
      transitions: [],
      keyframes: [],
      compositions: [],
    },
  };
}

function secondsToFrames(seconds: number): number {
  return Math.round(seconds * DEFAULT_FPS);
}

function createVideoTracks(aspectRatio: '9:16' | '16:9' | '1:1'): PixelsTrack[] {
  const tracks: PixelsTrack[] = [
    {
      id: 'video-1',
      name: 'V1 - Main Video',
      kind: 'video',
      height: 60,
      locked: false,
      syncLock: true,
      visible: true,
      muted: false,
      solo: false,
      order: 0,
      items: [],
    },
  ];

  if (aspectRatio !== '1:1') {
    tracks.push({
      id: 'video-2',
      name: 'V2 - Overlays',
      kind: 'video',
      height: 60,
      locked: false,
      syncLock: true,
      visible: true,
      muted: false,
      solo: false,
      order: 1,
      items: [],
    });
  }

  tracks.push({
    id: 'audio-1',
    name: 'A1 - Narration',
    kind: 'audio',
    height: 60,
    locked: false,
    syncLock: true,
    visible: true,
    muted: false,
    solo: false,
    order: aspectRatio === '1:1' ? 1 : 2,
    items: [],
  });

  return tracks;
}

// ============================================================================
// Edit Operation Builders
// ============================================================================

interface EditOp {
  op: string;
  callerId?: string;
  [key: string]: unknown;
}

function createImportMediaOps(post: PostData, aspectRatio: string): EditOp[] {
  const ops: EditOp[] = [];

  // Import banner
  const bannerUrl = post.bannerUrls[aspectRatio as keyof typeof post.bannerUrls];
  if (bannerUrl) {
    ops.push({
      op: 'importMedia',
      callerId: `import-banner-${aspectRatio}`,
      mediaId: `banner-${aspectRatio}`,
      url: resolveGroveUrl(bannerUrl),
    });
  }

  // Import video
  const videoUrl = post.videoUrls[aspectRatio as keyof typeof post.videoUrls];
  if (videoUrl) {
    ops.push({
      op: 'importMedia',
      callerId: `import-video-${aspectRatio}`,
      mediaId: `video-${aspectRatio}`,
      url: resolveGroveUrl(videoUrl),
    });
  }

  // Import audio
  if (post.audioUrl) {
    ops.push({
      op: 'importMedia',
      callerId: 'import-audio',
      mediaId: 'audio-narration',
      url: resolveGroveUrl(post.audioUrl),
    });
  }

  return ops;
}

function createTimelineOps(
  post: PostData,
  aspectRatio: '9:16' | '16:9' | '1:1',
  totalDuration: number
): EditOp[] {
  const ops: EditOp[] = [];
  const isVertical = aspectRatio === '9:16';
  const isSquare = aspectRatio === '1:1';

  let currentFrame = 0;

  // 1. INTRO: Banner full-screen (2s)
  const introDurationFrames = secondsToFrames(2.0);
  ops.push({
    op: 'addClip',
    callerId: 'introClip',
    mediaId: `banner-${aspectRatio}`,
    trackId: 'video-1',
    from: 0,
    durationInFrames: introDurationFrames,
  });

  ops.push({
    op: 'addText',
    callerId: 'introLogo',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: 0,
    durationInFrames: introDurationFrames,
    text: BRANDING.logoText,
    fontSize: 48,
    fontWeight: 'bold',
    color: BRANDING.colors.textPrimary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { opacity: 0 },
  });

  ops.push({
    op: 'addKeyframe',
    callerId: 'logoFadeIn',
    itemId: { $ref: 'introLogo#/detail/id' },
    property: 'opacity',
    frame: 6,
    value: 1,
    easing: 'ease-out',
  });

  currentFrame = introDurationFrames;

  // 2. TITLE CARD (3s)
  const titleDurationFrames = secondsToFrames(3.0);
  ops.push({
    op: 'addText',
    callerId: 'titleText',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: titleDurationFrames,
    text: post.title,
    fontSize: BRANDING.typography.sizes.title,
    fontWeight: 'bold',
    color: BRANDING.colors.textPrimary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { y: 100, opacity: 0 },
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'titleText#/detail/id' },
    property: 'y',
    frame: currentFrame + 24,
    value: 0,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'titleText#/detail/id' },
    property: 'opacity',
    frame: currentFrame + 24,
    value: 1,
    easing: 'ease-out',
  });

  currentFrame += titleDurationFrames;

  // 3. TEASER (4s)
  const teaserDurationFrames = secondsToFrames(4.0);
  ops.push({
    op: 'addText',
    callerId: 'teaserText',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: teaserDurationFrames,
    text: post.teaserText,
    fontSize: BRANDING.typography.sizes.teaser,
    fontWeight: 'medium',
    color: BRANDING.colors.textSecondary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { opacity: 0 },
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'teaserText#/detail/id' },
    property: 'opacity',
    frame: currentFrame + 18,
    value: 1,
    easing: 'ease-out',
  });

  currentFrame += teaserDurationFrames;

  // 4. KEY QUOTE (4s)
  const quoteDurationFrames = secondsToFrames(4.0);
  const quoteText = post.keyQuote || post.teaserText;
  ops.push({
    op: 'addText',
    callerId: 'quoteText',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: quoteDurationFrames,
    text: quoteText,
    fontSize: BRANDING.typography.sizes.quote,
    fontWeight: 'semibold',
    color: BRANDING.colors.textPrimary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { scale: 0.8, opacity: 0 },
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'quoteText#/detail/id' },
    property: 'scale',
    frame: currentFrame + 21,
    value: 1,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'quoteText#/detail/id' },
    property: 'opacity',
    frame: currentFrame + 21,
    value: 1,
    easing: 'ease-out',
  });

  currentFrame += quoteDurationFrames;

  // 5. CTA (2.5s)
  const ctaDurationFrames = secondsToFrames(2.5);
  ops.push({
    op: 'addText',
    callerId: 'ctaPrimary',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: ctaDurationFrames,
    text: 'Subscribe at dearcreative.xyz',
    fontSize: BRANDING.typography.sizes.cta,
    fontWeight: 'semibold',
    color: BRANDING.colors.accent,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { y: 100 },
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'ctaPrimary#/detail/id' },
    property: 'y',
    frame: currentFrame + 15,
    value: isVertical ? -120 : -100,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'ctaPrimary#/detail/id' },
    property: 'opacity',
    frame: currentFrame + 15,
    value: 1,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'ctaPrimary#/detail/id' },
    property: 'y',
    frame: currentFrame + secondsToFrames(1.5) + 15,
    value: isVertical ? -120 : -100,
    easing: 'ease-in',
  });

  ops.push({
    op: 'addText',
    callerId: 'ctaSecondary',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: ctaDurationFrames,
    text: 'Tip the author • Share this issue',
    fontSize: BRANDING.typography.sizes.meta,
    fontWeight: 'regular',
    color: BRANDING.colors.textSecondary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { y: 180 },
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'ctaSecondary#/detail/id' },
    property: 'y',
    frame: currentFrame + 20,
    value: isVertical ? -40 : -20,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addKeyframe',
    itemId: { $ref: 'ctaSecondary#/detail/id' },
    property: 'opacity',
    frame: currentFrame + 20,
    value: 1,
    easing: 'ease-out',
  });

  ops.push({
    op: 'addText',
    callerId: 'ctaLogo',
    trackId: isSquare ? 'video-1' : 'video-2',
    from: currentFrame,
    durationInFrames: ctaDurationFrames,
    text: BRANDING.logoText,
    fontSize: 24,
    fontWeight: 'bold',
    color: BRANDING.colors.textPrimary,
    textAlign: 'center',
    verticalAlign: 'middle',
    transform: { y: isVertical ? 320 : 280 },
  });

  currentFrame += ctaDurationFrames;

  // 6. AUDIO
  const totalFrames = secondsToFrames(totalDuration);
  ops.push({
    op: 'addClip',
    callerId: 'audioClip',
    mediaId: 'audio-narration',
    trackId: 'audio-1',
    from: 0,
    durationInFrames: totalFrames,
  });

  // 7. TRANSITIONS
  ops.push({
    op: 'addTransition',
    leftClipId: { $ref: 'introClip#/detail/id' },
    rightClipId: { $ref: 'titleText#/detail/id' },
    durationInFrames: 15,
    presentation: 'crossfade',
  });

  ops.push({
    op: 'addTransition',
    leftClipId: { $ref: 'titleText#/detail/id' },
    rightClipId: { $ref: 'teaserText#/detail/id' },
    durationInFrames: 15,
    presentation: 'crossfade',
  });

  ops.push({
    op: 'addTransition',
    leftClipId: { $ref: 'teaserText#/detail/id' },
    rightClipId: { $ref: 'quoteText#/detail/id' },
    durationInFrames: 15,
    presentation: 'crossfade',
  });

  ops.push({
    op: 'addTransition',
    leftClipId: { $ref: 'quoteText#/detail/id' },
    rightClipId: { $ref: 'ctaPrimary#/detail/id' },
    durationInFrames: 15,
    presentation: 'crossfade',
  });

  return ops;
}

// ============================================================================
// Main Generation Function
// ============================================================================

export interface GenerateClipsOptions {
  postSlug: string;
  db: DearCreativeDb;
  pixelsBaseUrl: string;
  outputFormats?: Array<"9:16" | "16:9" | "1:1">;
  durationSeconds?: number;
  usePostAudio?: boolean;
  /** When set, skips DB load and uses this payload (for tests or preloaded data). */
  post?: PostData;
  uploadToGrove?: typeof uploadToLensGrove;
  fetchFn?: typeof fetch;
  pixelsClient?: PixelsHttpClient;
}

export async function generateDearCreativeClips(
  options: GenerateClipsOptions,
): Promise<DearCreativeClipsResult> {
  const {
    postSlug,
    db,
    pixelsBaseUrl,
    outputFormats = ["9:16", "16:9", "1:1"],
    durationSeconds = 15.5,
    usePostAudio = true,
    post: postOverride,
    uploadToGrove = uploadToLensGrove,
    fetchFn = fetch,
    pixelsClient,
  } = options;

  if (!pixelsBaseUrl.trim()) {
    throw new Error("pixelsBaseUrl is required");
  }

  const post =
    postOverride ??
    (await loadPixelsPostDataFromDb(db, postSlug));
  if (!post) {
    throw new Error(`Post not found or missing clip assets: ${postSlug}`);
  }

  // Validate required fields
  if (!post.audioUrl && usePostAudio) {
    throw new Error('Post has no audioUrl and usePostAudio is true');
  }
  if (!post.bannerUrls['16:9'] || !post.bannerUrls['1:1']) {
    throw new Error('Post missing required banner URLs (16:9, 1:1)');
  }
  if (!post.videoUrls['16:9'] || !post.videoUrls['9:16']) {
    throw new Error('Post missing required video URLs (16:9, 9:16)');
  }

  const pixels = pixelsClient ?? new PixelsHttpClient(pixelsBaseUrl);

  // 3. Generate clips for each format
  const results: Partial<DearCreativeClipsResult> = {};

  for (const format of outputFormats) {
    const aspectRatio = format;
    const projectId = `dear-creative-${postSlug}-${aspectRatio.replace(':', '')}-${Date.now()}`;

    // Determine dimensions
    let width: number, height: number;
    switch (aspectRatio) {
      case '9:16':
        width = DEFAULT_WIDTH_9_16;
        height = DEFAULT_HEIGHT_9_16;
        break;
      case '16:9':
        width = DEFAULT_WIDTH_16_9;
        height = DEFAULT_HEIGHT_16_9;
        break;
      case "1:1":
        width = DEFAULT_WIDTH_1_1;
        height = DEFAULT_HEIGHT_1_1;
        break;
      default: {
        const _exhaustive: never = aspectRatio;
        throw new Error(`Unsupported aspect ratio: ${_exhaustive}`);
      }
    }

    // Create project
    const project = createBaseProject(projectId, `Dear Creative ${aspectRatio}`, width, height, durationSeconds);
    project.timeline.tracks = createVideoTracks(aspectRatio);

    const createdProject = await pixels.createProject(project);

    // Build edit operations
    const importOps = createImportMediaOps(post, aspectRatio);
    const timelineOps = createTimelineOps(post, aspectRatio, durationSeconds);
    const allOps = [...importOps, ...timelineOps];

    // Apply edits
    await pixels.editProject(createdProject.id, allOps, true);

    // Render
    const aspectRatioForResolution = aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '16:9' ? '1920x1080' : '1080x1080';
    const renderResponse = await pixels.renderProject({
      project: createdProject.id,
      codec: 'h264',
      container: 'mp4',
      resolution: aspectRatioForResolution,
      fps: DEFAULT_FPS,
      quality: 'high',
      duration: durationSeconds,
    });

    const videoBytes = await fetchRenderArtifactBytes(renderResponse, fetchFn);
    const uploadResponse = await uploadToGrove(
      new Blob([Buffer.from(videoBytes)], { type: "video/mp4" }),
      `${postSlug}-${aspectRatio.replace(":", "x")}.mp4`,
    );
    const clip = buildGeneratedClip(uploadResponse, {
      durationSeconds,
      width,
      height,
    });

    // Store result
    if (aspectRatio === '9:16') {
      results.reel9x16 = clip;
    } else if (aspectRatio === '16:9') {
      results.short16x9 = clip;
    } else if (aspectRatio === '1:1') {
      results.thumbnail1x1 = clip;
    }

  }

  return results as DearCreativeClipsResult;
}

function buildGeneratedClip(
  upload: LensGroveUploadResult,
  meta: { durationSeconds: number; width: number; height: number },
): GeneratedClip {
  const gatewayUrl = upload.gatewayUrl;
  const url = gatewayUrl.includes("?")
    ? `${gatewayUrl}&ext=mp4`
    : `${gatewayUrl}?ext=mp4`;
  return {
    url,
    uri: upload.uri,
    storageKey: upload.storageKey,
    durationSeconds: meta.durationSeconds,
    width: meta.width,
    height: meta.height,
    fps: DEFAULT_FPS,
    codec: "h264",
    container: "mp4",
  };
}