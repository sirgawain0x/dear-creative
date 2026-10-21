import { AuthorProfileView } from "@/components/authors/author-profile-view";
import { AuthorProfileEditPreviewStatic } from "./author-profile-edit-preview-static";
import type {
  AuthorProfileRecord,
  AuthorPublishedArticle,
} from "@/lib/authors/author-profile";

export const AUTHOR_PROFILE_PREVIEW: AuthorProfileRecord = {
  id: "preview-author",
  name: "Jordan Ellis",
  slug: "jordan-ellis",
  bio: "Essays on creative tools, publishing, and the craft of building in public.",
  avatarUrl: null,
};

export const AUTHOR_PROFILE_PREVIEW_ARTICLES: AuthorPublishedArticle[] = [
  {
    id: "a1",
    slug: "design-systems-for-writers",
    title: "Design systems for writers",
    publishedAtLabel: "Oct 12, 2026",
    role: "author",
  },
  {
    id: "a2",
    slug: "collaborative-editing",
    title: "Collaborative editing without losing voice",
    publishedAtLabel: "Sep 28, 2026",
    role: "cowriter",
  },
  {
    id: "a3",
    slug: "newsletter-metrics",
    title: "Newsletter metrics that actually matter",
    publishedAtLabel: "Sep 3, 2026",
    role: "author",
  },
];

/** Static markup harness for PR screenshots (not mounted in production). */
export function AuthorProfilePreviewPage() {
  return (
    <AuthorProfileView
      author={AUTHOR_PROFILE_PREVIEW}
      articles={AUTHOR_PROFILE_PREVIEW_ARTICLES}
      editHref="/authors/preview-author/edit"
    />
  );
}

export function AuthorProfileEditPreviewPage() {
  return <AuthorProfileEditPreviewStatic />;
}
