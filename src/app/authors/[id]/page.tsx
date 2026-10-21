import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthorProfileView } from "@/components/authors/author-profile-view";
import { getDb } from "@/db/client";
import { gateAuthorProfilePage } from "@/lib/authors/gate-author-profile-page";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import {
  getAuthorProfileById,
  listPublishedArticlesForAuthor,
  type AuthorProfileRecord,
} from "@/lib/authors/author-profile";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export async function generateMetadata({ params }: PageProps) {
  if (!isAuthorProfilesEnabled()) {
    notFound();
  }
  const { id } = await params;
  const author = await getAuthorProfileById(getDb(), id);
  if (!author) {
    notFound();
  }
  return {
    title: `${author.name} · Dear Creative`,
    description: author.bio ?? `Articles by ${author.name}`,
  };
}

async function AuthorProfileArticles({
  author,
  authorId,
}: {
  author: AuthorProfileRecord;
  authorId: string;
}) {
  await connection();
  const articles = await listPublishedArticlesForAuthor(getDb(), authorId);
  return (
    <AuthorProfileView
      author={author}
      articles={articles}
      editHref={`/authors/${encodeURIComponent(authorId)}/edit`}
    />
  );
}

export default async function AuthorProfilePage(props: PageProps) {
  const { id } = await props.params;
  const author = await gateAuthorProfilePage(id);

  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-16">Loading…</main>}>
      <AuthorProfileArticles author={author} authorId={id} />
    </Suspense>
  );
}
