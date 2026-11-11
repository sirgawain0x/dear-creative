"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COINBASE_CHECKOUT_ORIGIN,
  coinbaseCheckoutUrl,
} from "@/lib/wallet/coinbase-onramp";

type Props = {
  getHeaders: () => Promise<{ Authorization: string } | null>;
  onSettled: () => void;
};

export function ReaderWalletOnramp({ getHeaders, onSettled }: Props) {
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
          onSettled();
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
  }, [onSettled]);

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
