import type { PostStatus } from "@/db/schema";

export function isPublishedPostStatus(status: PostStatus): boolean {
  return status === "published";
}

export function canCreatePostPreviewLink(status: PostStatus): boolean {
  return !isPublishedPostStatus(status);
}
