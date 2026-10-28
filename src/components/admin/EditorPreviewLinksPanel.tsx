"use client";

import { useCallback, useEffect, useState } from "react";

type PreviewLinkRow = {
  id: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
};

type EditorPreviewLinksPanelProps = {
  postId: string | null;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  enabled: boolean;
};

export function EditorPreviewLinksPanel({
  postId,
  authFetch,
  enabled,
}: EditorPreviewLinksPanelProps) {
  const [links, setLinks] = useState<PreviewLinkRow[]>([]);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadLinks = useCallback(async () => {
    if (!postId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/adam/posts/${postId}/preview-links`);
      const data = (await res.json()) as {
        links?: PreviewLinkRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to load preview links");
        return;
      }
      setLinks(data.links ?? []);
    } catch {
      setError("Failed to load preview links");
    } finally {
      setLoading(false);
    }
  }, [authFetch, postId]);

  useEffect(() => {
    if (!enabled || !postId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      await loadLinks();
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, loadLinks, postId]);

  const handleSharePreview = async () => {
    if (!postId) {
      return;
    }
    setCreating(true);
    setError(null);
    setCopyHint(null);
    try {
      const res = await authFetch(`/api/adam/posts/${postId}/preview-links`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        link?: { previewUrl: string };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to create preview link");
        return;
      }
      const url = data.link?.previewUrl;
      if (!url) {
        setError("Missing preview URL");
        return;
      }
      setLastCreatedUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopyHint("Link copied to clipboard.");
      } catch {
        setCopyHint("Copy the link below.");
      }
      await loadLinks();
    } catch {
      setError("Failed to create preview link");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    if (!postId) {
      return;
    }
    setError(null);
    try {
      const res = await authFetch(
        `/api/adam/posts/${postId}/preview-links/${linkId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to revoke link");
        return;
      }
      if (lastCreatedUrl) {
        setLastCreatedUrl(null);
      }
      await loadLinks();
    } catch {
      setError("Failed to revoke link");
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
      data-testid="editor-preview-links-panel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Share preview
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Anyone with the link can read this draft for 7 days. Links are
            secret and can be revoked anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSharePreview()}
          disabled={!postId || creating}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {creating ? "Creating…" : "Share preview"}
        </button>
      </div>

      {copyHint ? (
        <p className="mb-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          {copyHint}
        </p>
      ) : null}
      {lastCreatedUrl ? (
        <p className="mb-2 break-all rounded-md border border-zinc-200 bg-white px-2 py-1.5 font-mono text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {lastCreatedUrl}
        </p>
      ) : null}
      {error ? (
        <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          Active links
        </p>
        {loading ? (
          <p className="text-[11px] text-zinc-500">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-[11px] text-zinc-500">No active preview links.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
                  Expires{" "}
                  {new Date(link.expiresAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRevoke(link.id)}
                  className="text-[10px] font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
