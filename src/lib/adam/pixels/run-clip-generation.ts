import type { DearCreativeDb } from "@/db/client";
import {
  generateDearCreativeClips,
  type DearCreativeClipsResult,
} from "./pixels-template-client";
import { loadPixelsPostDataFromDb } from "./post-data";

export type PixelsClipGenerationPreview = {
  dryRun: true;
  slug: string;
  title: string;
  outputFormats: Array<"9:16" | "16:9" | "1:1">;
  hasAudio: boolean;
  hasVideoAssets: boolean;
};

export type PixelsClipGenerationResult =
  | PixelsClipGenerationPreview
  | { dryRun: false; clips: DearCreativeClipsResult };

export async function runDearCreativePixelsClipGeneration(input: {
  db: DearCreativeDb;
  slug: string;
  dryRun: boolean;
  pixelsBaseUrl?: string;
}): Promise<PixelsClipGenerationResult> {
  const slug = input.slug.trim();
  const post = await loadPixelsPostDataFromDb(input.db, slug);
  if (!post) {
    throw new Error(`Published post not found or missing clip assets: ${slug}`);
  }

  if (input.dryRun) {
    return {
      dryRun: true,
      slug: post.slug,
      title: post.title,
      outputFormats: ["9:16", "16:9", "1:1"],
      hasAudio: Boolean(post.audioUrl),
      hasVideoAssets: Boolean(
        post.videoUrls["16:9"] && post.videoUrls["9:16"],
      ),
    };
  }

  const pixelsBaseUrl = input.pixelsBaseUrl?.trim();
  if (!pixelsBaseUrl) {
    throw new Error("Pixels API base URL is not configured");
  }

  const clips = await generateDearCreativeClips({
    postSlug: slug,
    db: input.db,
    pixelsBaseUrl,
    post,
  });

  return { dryRun: false, clips };
}
