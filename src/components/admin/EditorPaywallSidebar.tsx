"use client";

import React, { useState } from "react";
import { isAddress } from "viem";

export interface PaywallSettings {
  isGated: boolean;
  gatePriceUsdc: number;
  payoutAddress: string;
  freeContent: string;
  gatedContent: string;
}

interface EditorPaywallSidebarProps {
  settings: PaywallSettings;
  onChange: (updated: PaywallSettings) => void;
  onInsertGateTag: (tagType: "wrapper" | "split") => void;
  defaultAuthorPayoutAddress?: string;
  authorMeTokenSymbol?: string;
}

export function EditorPaywallSidebar({
  settings,
  onChange,
  onInsertGateTag,
  defaultAuthorPayoutAddress = "",
  authorMeTokenSymbol = "CRTVAI",
}: EditorPaywallSidebarProps) {
  const [addressError, setAddressError] = useState<string | null>(null);
  const accessMode: "free" | "paid" = settings.isGated ? "paid" : "free";

  const setAccessMode = (mode: "free" | "paid") => {
    onChange({
      ...settings,
      isGated: mode === "paid",
      payoutAddress: settings.payoutAddress || defaultAuthorPayoutAddress,
    });
  };

  const handlePriceChange = (value: string) => {
    const num = parseFloat(value);
    onChange({
      ...settings,
      gatePriceUsdc: isNaN(num) || num < 0.25 ? 0.25 : Math.round(num * 100) / 100,
    });
  };

  const handleAddressChange = (address: string) => {
    const trimmed = address.trim();
    if (trimmed && !isAddress(trimmed)) {
      setAddressError("Invalid Base EVM address format");
    } else {
      setAddressError(null);
    }
    onChange({
      ...settings,
      payoutAddress: trimmed,
    });
  };

  return (
    <aside className="w-full md:w-80 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-6 text-white shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-zinc-100">
            Access &amp; Paywall
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Choose whether this post is free for everyone or paid
          </p>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-400 border border-blue-500/20">
          Base L2
        </span>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-zinc-200">Access</span>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1"
          role="radiogroup"
          aria-label="Post access"
        >
          <button
            type="button"
            role="radio"
            aria-checked={accessMode === "free"}
            onClick={() => setAccessMode("free")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              accessMode === "free"
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Free
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={accessMode === "paid"}
            onClick={() => setAccessMode("paid")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              accessMode === "paid"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paid
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          {accessMode === "free"
            ? "The full post is public for all readers, even when site paywalls are enabled."
            : "Readers see free_content as a preview; gated_content requires subscription or unlock."}
        </p>
      </div>

      {settings.isGated ? (
        <div className="space-y-5 pt-2 border-t border-zinc-900">
          <div className="space-y-2">
            <label
              htmlFor="paywall-free-content"
              className="text-xs font-mono text-zinc-300"
            >
              free_content (public preview)
            </label>
            <textarea
              id="paywall-free-content"
              value={settings.freeContent}
              onChange={(e) =>
                onChange({ ...settings, freeContent: e.target.value })
              }
              rows={4}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none font-mono"
              placeholder="Markdown or HTML shown before the paywall…"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="paywall-gated-content"
              className="text-xs font-mono text-zinc-300"
            >
              gated_content (subscribers only)
            </label>
            <textarea
              id="paywall-gated-content"
              value={settings.gatedContent}
              onChange={(e) =>
                onChange({ ...settings, gatedContent: e.target.value })
              }
              rows={5}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none font-mono"
              placeholder="Markdown or HTML behind the paywall…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-300">
                Gate Price (USDC)
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">Min $0.25</span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500 text-xs">
                $
              </span>
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={settings.gatePriceUsdc}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-2 pl-7 pr-14 text-sm text-white focus:border-blue-500 focus:outline-none font-mono"
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-xs font-mono text-zinc-400">
                USDC
              </span>
            </div>
            <div className="flex gap-1.5 pt-1">
              {[0.5, 1.0, 2.0, 5.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ ...settings, gatePriceUsdc: preset })}
                  className={`flex-1 rounded-lg py-1 text-[11px] font-mono border transition ${
                    settings.gatePriceUsdc === preset
                      ? "border-blue-500 bg-blue-500/15 text-blue-400 font-semibold"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  ${preset.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-300">
              Insert Editor Markers
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onInsertGateTag("wrapper")}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left hover:border-zinc-700 transition"
              >
                <div className="text-xs font-medium text-zinc-200">Wrap Selection</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  &lt;!-- GATE --&gt;
                </div>
              </button>
              <button
                type="button"
                onClick={() => onInsertGateTag("split")}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left hover:border-zinc-700 transition"
              >
                <div className="text-xs font-medium text-zinc-200">Cut-off Line</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  Paywall below
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-300">
              Author Base Address
            </label>
            <input
              type="text"
              placeholder={defaultAuthorPayoutAddress || "0x..."}
              value={settings.payoutAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              className={`w-full rounded-xl border bg-zinc-900/70 py-2 px-3 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono ${
                addressError
                  ? "border-rose-500"
                  : "border-zinc-800 focus:border-blue-500"
              }`}
            />
            {addressError ? (
              <p className="text-[11px] text-rose-400">{addressError}</p>
            ) : null}
            <p className="text-[11px] text-zinc-500 leading-tight">
              100% of collected USDC routes directly to this address upon reader unlock.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Author Patron Token: ${authorMeTokenSymbol}
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Readers can back your author profile separately on Base via your $
          {authorMeTokenSymbol} bonding curve without altering post gate pricing.
        </p>
      </div>
    </aside>
  );
}
