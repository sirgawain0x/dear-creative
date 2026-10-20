"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublishGateCheck } from "@/lib/cowriters/publish-gate";

type WriterChip = {
  id: string;
  role: "author" | "cowriter";
  status: "pending" | "accepted" | "removed";
  shareBps: number;
  displayLabel: string;
  needsPayoutWallet: boolean;
};

type WritersResponse = {
  writers: WriterChip[];
  publishGate: {
    applies: boolean;
    blocked: boolean;
    checks: PublishGateCheck[];
  };
};

type EditorWritersPanelProps = {
  postId: string | null;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  enabled: boolean;
  isPublishedTarget: boolean;
};

export function EditorWritersPanel({
  postId,
  authFetch,
  enabled,
  isPublishedTarget,
}: EditorWritersPanelProps) {
  const [writers, setWriters] = useState<WriterChip[]>([]);
  const [publishGate, setPublishGate] = useState<WritersResponse["publishGate"] | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteWallet, setInviteWallet] = useState("");
  const [inviteMode, setInviteMode] = useState<"email" | "wallet">("email");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWriters = useCallback(async () => {
    if (!enabled || !postId) {
      setWriters([]);
      setPublishGate(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/adam/posts/${postId}/writers`);
      const data = (await res.json()) as WritersResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load writers");
        return;
      }
      setWriters(data.writers);
      setPublishGate(data.publishGate);
    } catch {
      setError("Failed to load writers");
    } finally {
      setLoading(false);
    }
  }, [authFetch, enabled, postId]);

  useEffect(() => {
    void loadWriters();
  }, [loadWriters]);

  if (!enabled) {
    return null;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!postId) {
      return;
    }
    setError(null);
    setLastInviteUrl(null);
    try {
      const body =
        inviteMode === "email"
          ? { email: inviteEmail.trim() }
          : { wallet: inviteWallet.trim() };
      const res = await authFetch(`/api/adam/posts/${postId}/writers/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as WritersResponse & {
        error?: string;
        invite?: { inviteUrl: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Invite failed");
        return;
      }
      setWriters(data.writers);
      setPublishGate(data.publishGate);
      setLastInviteUrl(data.invite?.inviteUrl ?? null);
      setInviteEmail("");
      setInviteWallet("");
    } catch {
      setError("Invite failed");
    }
  }

  async function handleRemove(membershipId: string) {
    if (!postId) {
      return;
    }
    setError(null);
    try {
      const res = await authFetch(
        `/api/adam/posts/${postId}/writers/${membershipId}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as WritersResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Remove failed");
        return;
      }
      setWriters(data.writers);
      setPublishGate(data.publishGate);
    } catch {
      setError("Remove failed");
    }
  }

  function chipStatusLabel(chip: WriterChip): string {
    if (chip.role === "author") {
      return chip.needsPayoutWallet ? "needs payout wallet" : "author";
    }
    if (chip.status === "pending") {
      return "pending";
    }
    if (chip.needsPayoutWallet) {
      return "needs payout wallet";
    }
    return "accepted";
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          Writers (byline only)
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Co-writers appear on the byline after accepting. They cannot edit this
          post.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading writers…</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {writers.map((chip) => (
            <li
              key={chip.id}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="font-medium">{chip.displayLabel}</span>
              <span className="text-zinc-500">
                {chip.role === "author" ? "Author" : "Co-writer"} ·{" "}
                {(chip.shareBps / 100).toFixed(2)}% · {chipStatusLabel(chip)}
              </span>
              {chip.role === "cowriter" ? (
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() => void handleRemove(chip.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void handleInvite(e)} className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              checked={inviteMode === "email"}
              onChange={() => setInviteMode("email")}
            />
            Email invite
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              checked={inviteMode === "wallet"}
              onChange={() => setInviteMode("wallet")}
            />
            Wallet invite
          </label>
        </div>
        {inviteMode === "email" ? (
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="coauthor@example.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        ) : (
          <input
            type="text"
            value={inviteWallet}
            onChange={(e) => setInviteWallet(e.target.value)}
            placeholder="0x…"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        )}
        <button
          type="submit"
          disabled={!postId}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add co-writer
        </button>
      </form>

      {lastInviteUrl ? (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            Copy invite link (single-use, 7 days)
          </p>
          <code className="mt-1 block break-all text-[11px]">{lastInviteUrl}</code>
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={() => void navigator.clipboard.writeText(lastInviteUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      {isPublishedTarget && publishGate?.applies ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs font-semibold">Publish readiness</p>
          <ul className="mt-2 space-y-1 text-xs">
            {publishGate.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2">
                <span>{check.ok ? "✅" : "⬜"}</span>
                <span className={check.ok ? "text-zinc-600" : "text-amber-700"}>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
