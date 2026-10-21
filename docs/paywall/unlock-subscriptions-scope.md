# Unlock Protocol subscriptions — scope (Dear Creative)

**Status:** documentation only. No locks deployed, no on-chain transactions, no spend.  
**Per-post unlock (PR C):** $1 USDC default via `POST_UNLOCK_PRICE_USDC`, server receipt verification, table `reader_post_unlock_purchases` (migration written, not applied).

References: [Unlock networks (Base)](https://docs.unlock-protocol.com/core-protocol/unlock/networks), [Public Lock](https://docs.unlock-protocol.com/core-protocol/public-lock), [Renewals & `renewMembershipFor`](https://docs.unlock-protocol.com/core-protocol/public-lock/renewals), [Base deployment blog](https://unlock-protocol.com/blog/base), [v15 economics (1% protocol fee)](https://unlock-protocol.com/blog/unlock-protocol-v15---the-economics-update-).

---

## 1) Two USDC locks on Base (8453)

| Plan | Key price | Duration | Lock role |
|------|-----------|----------|-----------|
| Monthly | **$8 USDC** | **30 days** (`expirationDuration = 2_592_000` seconds) | Recurring membership |
| Yearly | **$80 USDC** | **365 days** (`expirationDuration = 31_536_000` seconds) | Recurring membership |

**Beneficiary (funds recipient):** G2’s immutable 90/10 PullSplit on Base — **`0xfc1577e86d0bc18c562a92e7e3a748e7177902af`** (canonical value from `writers.payout_split_address` for writer `g2`; see `src/lib/posts/post-tip-payee.test.ts` and production DB).

**Token:** USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` ([same as existing Dear Creative subscription config](https://github.com/sirgawain0x/dear-creative/blob/main/src/lib/payments/subscription-config.ts)).

**Who deploys:** **G2 signs** lock creation via Unlock Dashboard or `unlock-protocol/unlock-js` against the Base Unlock factory (`0xd0b14797b9D08493392865647384974470202A78` per [networks doc](https://docs.unlock-protocol.com/core-protocol/unlock/networks)). Dear Creative stores resulting lock addresses in env (e.g. `UNLOCK_LOCK_G2_MONTHLY`, `UNLOCK_LOCK_G2_YEARLY`) — not in this PR.

**Lock configuration (both locks):**

- `currencyContractAddress` = Base USDC (above)
- `keyPrice` = 8e6 / 80e6 USDC (6 decimals)
- `expirationDuration` = 30d / 365d
- `maxNumberOfKeys` = protocol max or a high cap agreed with G2 (sold-out protection)
- `maxKeysPerAddress` = 1 (one active membership key per wallet)
- **Renewable** = yes (enables `renewMembershipFor` / [automated renewals](https://docs.unlock-protocol.com/core-protocol/public-lock/renewals))
- **Referrer fee** = **0** (`setReferrerFee(0x0, 0)` — no affiliate cut; protocol referrer can still be zero address)
- **Transfers disabled** for subscribers (`disableTransfer` / transfer hook per lock policy; lock manager retains transfer rights per Public Lock v14+)

---

## 2) Reader flow — Alchemy smart account + paymaster

Target UX (future PR, not implemented here):

1. Reader signs in with Privy; app resolves or creates an **Alchemy smart account** on Base ([Alchemy Account Abstraction](https://www.alchemy.com/account-abstraction)).
2. Single **sponsored UserOperation** (paymaster pays gas) batching:
   - `USDC.approve(lock, allowance)` — allowance ≥ **12× key price** (monthly: 96 USDC; yearly: 960 USDC) to cover renewals without re-prompting every month
   - `PublicLock.purchase(...)` or equivalent purchase struct for v15 locks ([purchase args struct](https://docs.unlock-protocol.com/core-protocol/public-lock))
3. No server private keys; reader wallet/smart account signs. Server only reads chain state afterward.

---

## 3) Server access — `getHasValidKey` + caching vs `/api/subscriptions`

**Today (unchanged in prod):** Admin rail `POST /api/subscriptions/quote` + `POST /api/subscriptions/verify` writes to `subscriptions` + `payment_ledger` when `PAYMENTS_ENABLED=true`.

**Future reader rail:**

- After purchase, entitlement = **`PublicLock.getHasValidKey(lock, user)`** on Base ([Public Lock v14 note on hooks](https://docs.unlock-protocol.com/core-protocol/public-lock)).
- Server module (proposed): `src/lib/paywall/unlock-key-access.ts` with:
  - RPC read via Alchemy (`ALCHEMY_API_KEY`)
  - Cache: keyed by `(lockAddress, walletLower, chainId)` in Redis/Upstash or SQLite TTL table; invalidate on `ExpirationChanged` webhook or short TTL (e.g. 60–120s)
- **`canReadFull`:** OR together (a) Unlock valid key for writer’s lock(s), (b) per-post unlock row in `reader_post_unlock_purchases`, (c) legacy admin `subscriptions` row until deprecated.
- **Coexistence:** Keep `/api/subscriptions/*` for admin/card experiments; reader UI switches to Unlock when `UNLOCK_SUBSCRIPTIONS_ENABLED=true` (new flag, default off). No duplicate USDC-upfront subscription checkout.

---

## 4) Renewals

- **Primary:** Unlock Labs [automated renewal scripts](https://docs.unlock-protocol.com/core-protocol/public-lock/renewals) calling `renewMembershipFor` when ERC20 allowance and balance suffice.
- **Backup cron (Dear Creative):** daily job (Vercel cron / Cloud Run) for each lock:
  - Enumerate keys nearing expiry (subgraph or `keys` events)
  - Call `isRenewable(tokenId)`; on success `renewMembershipFor(tokenId, referrer, data)`
  - On failure: log + alert; do not grant off-chain access
- **Failure handling:** insufficient USDC → email/in-app “Add USDC / restore approval”; paymaster failure → retry with backoff
- **Lapse UX:** `getHasValidKey` false → paywall preview + “Renew membership” CTA (new purchase or extend flow)
- **Reminders:** 7d and 1d before expiry if `isRenewable` false (low balance or approval)

---

## 5) Cancellation & refunds

- **Cancel auto-renew:** user sets ERC20 `approve(lock, 0)` or uses in-app “Cancel renewal” (same effect). Existing key valid until `keyExpirationTimestampFor`.
- **Cancel membership early:** optional `cancelKey` / disable — product policy TBD with G2 (may forfeit remaining time).
- **Refunds (proposed):** no automatic on-chain refunds; **7-day goodwill refund** request window for first purchase only, manual USDC send from G2 treasury — document in ToS; Unlock protocol **1% fee** is non-refundable ([v15 economics](https://unlock-protocol.com/blog/unlock-protocol-v15---the-economics-update-)).

---

## 6) Per-post unlock config (`POST_UNLOCK_PRICE_USDC=1`)

Implemented in PR C:

- Env `POST_UNLOCK_PRICE_USDC` — defaults to **1**, validated as positive decimal ≤6 fractional digits; invalid → **1**.
- Server verifies exact USDC transfer to writer split before insert into `reader_post_unlock_purchases`.
- Independent of Unlock locks (one-off transfer, not a key).

---

## 7) `writerHasGatedPosts` → subscribe offer visibility

Implemented: `showUnlockProtocolSubscribeOffer` on paywall context is `true` only when the post’s writer has ≥1 **published gated** post (`writerHasGatedPosts`). UI shows scope copy only (no checkout). Per-post unlock remains adjacent when split + price configured.

---

## 8) Wert card entry (later phase)

Card/on-ramp via **Wert** — separate PR; requires new secrets **`WERT_PARTNER_ID`** and **`WERT_SIGNING_KEY`** (G2-owned). Flow: Wert widget → USDC to smart account → same batched approve+purchase. Not in scope for Unlock MVP.

---

## 9) Base Sepolia test plan

Use Unlock on **Base Sepolia** factory `0x259813B665C8f6074391028ef782e27B65840d89` ([networks](https://docs.unlock-protocol.com/core-protocol/unlock/networks)).

1. G2 deploys test locks (USDC test token or Unlock test ERC20 per dashboard).
2. Purchase key; assert **`getHasValidKey`** true and expiration ≈ now + duration.
3. Confirm **~1% protocol fee** to Unlock DAO on paid purchases ([v15 blog](https://unlock-protocol.com/blog/unlock-protocol-v15---the-economics-update-)).
4. Fast-forward time / short `expirationDuration` on test lock → key invalid → paywall blocks.
5. `renewMembershipFor` with approval → key valid again.
6. **Split withdrawal:** accumulate USDC on G2 test split `0xfc15…02af`; execute PullSplit withdraw; verify 90% writer / 10% platform on-chain.
7. No mainnet deploy until G2 signs off on Sepolia checklist.

---

## 10) Migrations, flags, PR breakdown, effort

### Migrations (G2 approval required before apply)

| Migration | Purpose | Status |
|-----------|---------|--------|
| `0019_reader_post_unlock_purchases.sql` | Per-post unlock receipts | **Written, not applied** |
| Future `0020_unlock_subscription_cache.sql` (optional) | TTL cache of `getHasValidKey` | Not written |

No migration for Unlock keys (entitlement is on-chain).

### Feature flags

| Flag | Meaning |
|------|---------|
| `PAYWALL_ENABLED=true` | Reader paywall + $1 unlock (PR C) |
| `UNLOCK_SUBSCRIPTIONS_ENABLED` (proposed) | Unlock purchase/renew UI + RPC checks |
| `PAYMENTS_ENABLED` | Existing admin USDC quote/verify (unchanged) |

Env (proposed): `UNLOCK_LOCK_G2_MONTHLY`, `UNLOCK_LOCK_G2_YEARLY`, `ALCHEMY_API_KEY`, paymaster policy IDs.

### PR breakdown (suggested)

| PR | Scope | Relative effort |
|----|--------|-----------------|
| **C (this draft)** | $1 post unlock + scope doc | **Done** |
| **D** | Lock address config + `getHasValidKey` reader + cache | Medium — RPC module, tests with mocked viem |
| **E** | Smart account batched purchase + paymaster | Large — AA pipeline, Privy + Alchemy |
| **F** | Renewal cron + notifications | Medium |
| **G** | Wert card phase | Large — new secrets, compliance |

### Open questions for G2

1. Confirm monthly/yearly **lock names**, `maxNumberOfKeys`, and whether yearly lock allows multi-period prepay (v15).
2. Confirm **12× approval** multiplier vs explicit per-renewal approval UX.
3. Deprecation timeline for admin **`/api/subscriptions`** vs Unlock-only reader path?
4. **Refund policy** final copy and who signs manual refund sends.
5. **Wert** partner onboarding owner and target launch window.
6. Store lock addresses in **env only** vs new `writers.unlock_lock_*` columns?
