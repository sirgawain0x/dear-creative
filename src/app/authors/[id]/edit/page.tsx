import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthorProfileEditForm } from "@/components/authors/author-profile-edit-form";
import { getDb } from "@/db/client";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import { ensureAuthorProfilesEnabled } from "@/lib/authors/guard";
import { getAuthorProfileById } from "@/lib/authors/author-profile";

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
  return { title: `Edit ${author.name} · Dear Creative` };
}

async function AuthorProfileEditContent({ params }: PageProps) {
  await connection();
  ensureAuthorProfilesEnabled();
  const { id } = await params;
  const author = await getAuthorProfileById(getDb(), id);
  if (!author) {
    notFound();
  }

  return <AuthorProfileEditForm author={author} />;
}

export default function AuthorProfileEditPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-16">Loading…</main>}>
      <AuthorProfileEditContent {...props} />
    </Suspense>
  );
}
