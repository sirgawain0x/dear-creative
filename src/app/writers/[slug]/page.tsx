import { notFound } from "next/navigation";
import Link from "next/link";
import { AuthorByline } from "@/components/posts/author-byline";
import { getDb } from "@/db/client";
import { getAuthorBySlug } from "@/lib/posts/post-author";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const author = await getAuthorBySlug(getDb(), slug);
  if (!author) {
    return { title: "Writer not found" };
  }
  return {
    title: `${author.name} · Dear Creative`,
    description: author.bio ?? `Writer profile for ${author.name}`,
  };
}

export default async function WriterProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const author = await getAuthorBySlug(getDb(), slug);
  if (!author) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/posts"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All Posts
      </Link>

      <div className="mt-8">
        <AuthorByline author={author} className="border-none pb-0" />
      </div>

      {author.bio ? (
        <p className="mt-6 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {author.bio}
        </p>
      ) : null}
    </main>
  );
}
