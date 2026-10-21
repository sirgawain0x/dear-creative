import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthorProfileView } from "@/components/authors/author-profile-view";
import { getDb } from "@/db/client";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import { ensureAuthorProfilesEnabled } from "@/lib/authors/guard";
import {
  getAuthorProfileById,
  listPublishedArticlesForAuthor,
} from "@/lib/authors/author-profile";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export async function generateMetadata({ params }: PageProps) {
  if (!isAuthorProfilesEnabled()) {
    return { title: "Not found" };
  }
  const { id } = await params;
  const author = await getAuthorProfileById(getDb(), id);
  if (!author) {
    return { title: "Author not found" };
  }
  return {
    title: `${author.name} · Dear Creative`,
    description: author.bio ?? `Articles by ${author.name}`,
  };
}

async function AuthorProfileContent({ params }: PageProps) {
  await connection();
  ensureAuthorProfilesEnabled();
  const { id } = await params;
  const db = getDb();
  const author = await getAuthorProfileById(db, id);
  if (!author) {
    notFound();
  }
  const articles = await listPublishedArticlesForAuthor(db, id);

  return (
    <AuthorProfileView
      author={author}
      articles={articles}
      editHref={`/authors/${encodeURIComponent(id)}/edit`}
    />
  );
}

export default function AuthorProfilePage(props: PageProps) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-16">Loading…</main>}>
      <AuthorProfileContent {...props} />
    </Suspense>
  );
}
