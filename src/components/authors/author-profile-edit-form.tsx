"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuthSession } from "@/components/providers/app-providers";
import { AUTHOR_TAGLINE_MAX_LENGTH } from "@/lib/authors/author-display-profile-limits";
import type { AuthorProfileRecord } from "@/lib/authors/author-profile";

export function AuthorProfileEditForm({
  author,
}: {
  author: AuthorProfileRecord;
}) {
  const router = useRouter();
  const { isSignedIn, getAccessToken, login } = useAuthSession();
  const [name, setName] = useState(author.name);
  const [tagline, setTagline] = useState(author.tagline ?? "");
  const [avatarUrl, setAvatarUrl] = useState(author.avatarUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [getAccessToken]);

  const onUpload = async (file: File) => {
    setStatus(null);
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setStatus("Sign in to upload a profile image.");
        return;
      }
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(`/api/authors/${author.id}/avatar`, {
        method: "POST",
        headers,
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setStatus(data.error ?? "Upload failed");
        return;
      }
      if (data.url) {
        setAvatarUrl(data.url);
      }
      setStatus("Profile image updated.");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setStatus(null);
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setStatus("Sign in to save your profile.");
        return;
      }
      const res = await fetch(`/api/authors/${author.id}/profile`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus(data.error ?? "Save failed");
        return;
      }
      setStatus("Profile saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with a Privy admin account to edit this profile.
        </p>
        <button
          type="button"
          onClick={() => login()}
          className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <Link
        href={`/authors/${encodeURIComponent(author.id)}`}
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Edit profile
      </h1>

      <div className="mt-8 space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="mt-2 w-full max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tagline
          </span>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={AUTHOR_TAGLINE_MAX_LENGTH}
            placeholder="One sentence about what you publish."
            className="mt-2 w-full max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {tagline.length}/{AUTHOR_TAGLINE_MAX_LENGTH} characters
          </span>
        </label>

        <div>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Profile image
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold dark:bg-zinc-800">
                {name.slice(0, 2).toUpperCase() || "?"}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void onUpload(file);
                }
              }}
              className="max-w-full text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>

        {status ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </main>
  );
}
