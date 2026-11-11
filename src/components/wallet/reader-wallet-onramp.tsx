"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuthSession } from "@/components/providers/app-providers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { privyAuthorizationHeaders } from "@/lib/privy/privy-authorization-headers";
import {
  COINBASE_CHECKOUT_ORIGIN,
  coinbaseCheckoutUrl,
} from "@/lib/wallet/coinbase-onramp";

type GetHeaders = () => Promise<{ Authorization: string } | null>;

export function HostedCoinbaseCheckoutButton({ getHeaders, label, className }: {
  getHeaders: GetHeaders;
  label: string;
  className: string;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openCheckout() {
    setPending(true);
    setFailed(false);
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Sign in required");
      const response = await fetch("/api/wallet/onramp", { method: "POST", headers });
      if (!response.ok) throw new Error("Checkout unavailable");
      const { checkoutUrl } = await response.json();
      const destination = coinbaseCheckoutUrl(checkoutUrl);
      if (!destination) throw new Error("Invalid checkout URL");
      window.location.assign(destination.href);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={pending} onClick={openCheckout}>
        {pending ? "Opening Coinbase…" : label}
      </button>
      {failed ? (
        <p role="alert" className="self-center text-xs">Couldn’t open Coinbase checkout. Try again.</p>
      ) : null}
    </>
  );
}

export function ReaderWalletCheckoutSheet({ open, onOpenChange, restoreFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus?: () => void;
}) {
  const amountId = useId();
  const { authenticated, getAccessToken, privyConfigured } = useAuthSession();
  const getHeaders = useCallback(
    () => privyAuthorizationHeaders({ authenticated, getAccessToken, privyConfigured }),
    [authenticated, getAccessToken, privyConfigured],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[110] overflow-y-auto"
        data-testid="reader-wallet-checkout"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(amountId)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus) return;
          event.preventDefault();
          restoreFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Add USDC with Apple Pay</SheetTitle>
          <SheetDescription>Fund your Base wallet through Coinbase.</SheetDescription>
        </SheetHeader>
        <ReaderWalletOnramp getHeaders={getHeaders} amountId={amountId} />
        <HostedCoinbaseCheckoutButton
          getHeaders={getHeaders}
          label="Use Coinbase Checkout"
          className="self-start text-xs underline"
        />
      </SheetContent>
    </Sheet>
  );
}

function ReaderWalletOnramp({ getHeaders, amountId }: { getHeaders: GetHeaders; amountId: string }) {
  const [amount, setAmount] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onCheckoutMessage(event: MessageEvent) {
      if (event.origin !== COINBASE_CHECKOUT_ORIGIN ||
          event.source !== iframeRef.current?.contentWindow) return;

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      switch (payload?.eventName) {
        case "onramp_api.commit_success":
          setNotice("Coinbase is processing your purchase…");
          break;
        case "onramp_api.polling_success":
          setCheckoutUrl(null);
          setNotice("Coinbase sent your USDC. Your balance may take a moment to update.");
          break;
        case "onramp_api.load_error":
          if (payload.data?.errorCode === "ERROR_CODE_GUEST_APPLE_PAY_NOT_SUPPORTED") break;
          setCheckoutUrl(null);
          setNotice("Coinbase could not load checkout. Try again or use Coinbase Checkout.");
          break;
        case "onramp_api.session_error":
        case "onramp_api.polling_error":
          setCheckoutUrl(null);
          setNotice("Coinbase could not complete the purchase. Check your wallet before retrying.");
          break;
        case "onramp_api.commit_error":
        case "onramp_api.validate_merchant_error":
          setNotice("Coinbase could not start the payment. Check the checkout details.");
          break;
      }
    }

    window.addEventListener("message", onCheckoutMessage);
    return () => window.removeEventListener("message", onCheckoutMessage);
  }, []);

  async function openCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error("Sign in required");
      const response = await fetch("/api/wallet/onramp/embedded", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          setNotice("Enter a positive USD amount with up to two decimal places.");
          return;
        }
        throw new Error("Checkout unavailable");
      }
      const { checkoutUrl: value } = await response.json();
      const url = coinbaseCheckoutUrl(value);
      if (!url) throw new Error("Invalid checkout URL");
      setCheckoutUrl(url.href);
    } catch {
      setNotice("Couldn’t open embedded checkout. Try again or use Coinbase Checkout.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      {checkoutUrl ? (
        <iframe
          ref={iframeRef}
          src={checkoutUrl}
          title="Coinbase Apple Pay checkout"
          className="h-[min(60vh,32rem)] w-full rounded-md bg-white"
          allow="payment"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      ) : (
        <form onSubmit={openCheckout} className="space-y-3 text-xs">
          <label className="block">
            Amount in USD
            <input
              id={amountId}
              type="text"
              inputMode="decimal"
              pattern="[0-9]{1,4}(\.[0-9]{1,2})?"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
            />
          </label>
          <p>Coinbase verifies eligible US customers and shows the USDC amount and fees before payment.</p>
          <p>
            By continuing, you agree to Coinbase’s{" "}
            <a className="underline" href="https://www.coinbase.com/legal/guest-checkout/us" target="_blank" rel="noreferrer">Guest Checkout Terms</a>,{" "}
            <a className="underline" href="https://www.coinbase.com/legal/user_agreement" target="_blank" rel="noreferrer">User Agreement</a>, and{" "}
            <a className="underline" href="https://www.coinbase.com/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
          </p>
          <button type="submit" disabled={pending} className="rounded-full border px-3 py-1.5 disabled:opacity-50">
            {pending ? "Preparing checkout…" : "Continue with Apple Pay"}
          </button>
        </form>
      )}
      <p role="status" className="text-xs">{notice}</p>
    </div>
  );
}
