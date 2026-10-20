"use client";

import { useState, type FormEvent } from "react";

type OracleIngestFormProps = {
  getAccessToken: () => Promise<string | null>;
};

export function OracleIngestForm({ getAccessToken }: OracleIngestFormProps) {
  const [questionId, setQuestionId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [txHash, setTxHash] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatus("Sign in with Privy to register predictions.");
        return;
      }

      const response = await fetch("/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId, questionText, txHash, slug }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        prediction?: { id: string };
      };

      if (!response.ok) {
        setStatus(data.error ?? `Request failed (${response.status})`);
        return;
      }

      setStatus(`Registered prediction ${data.prediction?.id ?? ""}`.trim());
      setQuestionId("");
      setQuestionText("");
      setTxHash("");
      setSlug("");
    } catch {
      setStatus("Network error while registering prediction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Register reality.eth prediction
      </h4>
      <p className="text-[11px] text-zinc-500">
        DB ingest only — paste the on-chain question id, question text, opening
        tx hash, and post slug.
      </p>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Question ID (bytes32)
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          value={questionId}
          onChange={(e) => setQuestionId(e.target.value)}
          placeholder="0x…"
          required
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Question text
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          required
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Opening tx hash
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x…"
          required
        />
      </label>

      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Post slug
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my-dispatch-slug"
          required
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save prediction"}
      </button>

      {status ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{status}</p>
      ) : null}
    </form>
  );
}
