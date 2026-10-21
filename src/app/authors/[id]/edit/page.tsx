import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthorProfileEditForm } from "@/components/authors/author-profile-edit-form";
import { getDb } from "@/db/client";
import { gateAuthorProfilePage } from "@/lib/authors/gate-author-profile-page";
import { isAuthorProfilesEnabled } from "@/lib/authors/feature-flag";
import {
  getAuthorProfileById,
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
  return { title: `Edit ${author.name} · Dear Creative` };
}

async function AuthorProfileEditBody({
  author,
}: {
  author: AuthorProfileRecord;
}) {
  await connection();
  return <AuthorProfileEditForm author={author} />;
}

export default async function AuthorProfileEditPage(props: PageProps) {
  const { id } = await props.params;
  const author = await gateAuthorProfilePage(id);

  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-16">Loading…</main>}>
      <AuthorProfileEditBody author={author} />
    </Suspense>
  );
}
