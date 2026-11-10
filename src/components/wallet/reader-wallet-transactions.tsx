"use client";

import { useCreateWallet, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useRef, useState } from "react";
import { getAddress } from "viem";
import { base } from "viem/chains";
import {
  buildAdminWalletSendCall,
  validateAdminWalletSendInput,
} from "@/lib/wallet/send-validation";

export function ReaderWalletCreateButton({ onCreated }: { onCreated: () => Promise<void> }) {
  const { createWallet } = useCreateWallet();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div>
      <button type="button" disabled={busy} className="rounded-full border px-3 py-1 text-sm"
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await createWallet();
            await onCreated();
          } catch {
            setMessage("Couldn’t create your wallet. Try refreshing or signing in again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Creating wallet…" : "Create wallet"}
      </button>
      <p role="status" className="mt-2 text-xs">{message}</p>
    </div>
  );
}

export function ReaderWalletSend({ address, balance }: { address: string; balance?: string }) {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<string>();
  const wallet = wallets.find(
    (candidate) => candidate.walletClientType === "privy" &&
      candidate.address.toLowerCase() === address.toLowerCase(),
  );

  return (
    <div className={open ? "w-full" : undefined}>
      <button type="button" className="rounded-full border px-3 py-1 text-sm"
        aria-expanded={open} onClick={() => setOpen(!open)}>
        Send
      </button>
      {open && (
        <form className="mt-3 grid gap-2 rounded-xl border p-3" onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current || !wallet || balance === undefined) return;
          setMessage("");
          setHash(undefined);
          const form = event.currentTarget;
          const fields = new FormData(form);
          const fromAddress = getAddress(wallet.address);
          const result = validateAdminWalletSendInput({
            recipient: String(fields.get("recipient") ?? ""),
            amount: String(fields.get("amount") ?? ""),
            fromAddress,
            balances: { usdcRaw: BigInt(balance) },
          });
          if (!result.ok) {
            setMessage(result.error);
            return;
          }
          submitting.current = true;
          setPending(true);
          try {
            const transaction = buildAdminWalletSendCall(result);
            const sent = await sendTransaction(
              { ...transaction, chainId: base.id },
              { address: fromAddress, uiOptions: { showWalletUIs: true } },
            );
            setHash(sent.hash);
            form.reset();
          } catch {
            setMessage("The send wasn’t confirmed. Check your wallet activity before trying again.");
          } finally {
            submitting.current = false;
            setPending(false);
          }
        }}>
          <p className="text-sm font-medium">Send USDC on Base</p>
          <label className="grid gap-1 text-xs">Recipient address
            <input className="rounded border p-2" name="recipient" required disabled={pending} />
          </label>
          <label className="grid gap-1 text-xs">Amount in USDC
            <input className="rounded border p-2" name="amount" inputMode="decimal" required disabled={pending} />
          </label>
          <button className="justify-self-start rounded-full border px-3 py-1 text-sm" type="submit"
            disabled={!wallet || balance === undefined || pending}>
            {pending ? "Waiting for Privy…" : "Review in Privy"}
          </button>
          {(!wallet || balance === undefined) && (
            <p className="text-xs">Sending requires a connected Privy wallet and an available balance.</p>
          )}
          <p role="status" className="text-xs">{message}</p>
          {hash && <a className="text-xs underline" href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">Transaction submitted · View on Basescan</a>}
        </form>
      )}
    </div>
  );
}
