import type { PublishedPostListItem } from "./published-posts";

export const HOME_SPOTLIGHT_LIMIT = 3;

export const HOME_SPOTLIGHT_EMPTY_MESSAGE =
  "No dispatches published yet. New issues will appear here when they go live.";

export type HomeSpotlightView =
  | { kind: "empty"; message: string }
  | { kind: "posts"; posts: PublishedPostListItem[] };

export function buildHomeSpotlightView(
  posts: PublishedPostListItem[],
): HomeSpotlightView {
  if (posts.length === 0) {
    return { kind: "empty", message: HOME_SPOTLIGHT_EMPTY_MESSAGE };
  }
  return { kind: "posts", posts };
}
