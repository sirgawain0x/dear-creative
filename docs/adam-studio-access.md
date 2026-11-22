# Adam Studio access

Adam Studio (`/adam`, plus the `/approvals` queue) is G2's private editorial tool. This document describes how
access is decided, how to grant it, and how to open the studio to paying members
later without another rewrite.

## The pass

| | |
| --- | --- |
| Contract | `0xf7c4cd399395d80f9d61fde833849106775269c6` (Unlock lock) |
| Name / symbol | `Creative Creator` / `CRTVM` |
| Network | Base mainnet (chain id `8453`) |
| Price | `10000000` USDC base units = **$10 USDC** |
| Key duration | `2592000` seconds = **30 days** |
| Membership check | `getHasValidKey(address)` — `true` while the key is unexpired |
| Settlement token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Reads go through `src/lib/adam/creator-pass.ts` (viem), with a 6s timeout, a short
cache (60s positive / 20s negative), and fail-closed behavior: if the RPC is
unreachable, nobody is granted access by membership.

## Who gets in today

`src/lib/adam/studio-access-server.ts` decides, in this order:

1. **Privy admin** — the user id is in `PRIVY_ADMIN_USER_IDS` (owner break-glass).
2. **Allowlisted wallet** — any wallet linked to the signed-in Privy account that
   appears in `ADAM_STUDIO_ALLOWED_WALLETS`, plus the built-in owner wallet
   `0xAE48B6dB64772b9CC24e33A79c809896776a20f6` (G2's Privy embedded wallet,
   confirmed to hold an active pass on-chain).
3. **Creator Pass** — only when `ADAM_STUDIO_MEMBERSHIP_ACCESS=creator_pass`.
   This is **off by default** so the 260+ other key holders cannot enter while the
   studio is still single-tenant.
4. **Studio Key** — `ADAM_API_TOKEN` entered at `/adam` (posted to
   `/api/adam/studio-key`, stored as an httpOnly cookie) or sent as
   `Authorization: Bearer` by the Adam service.

The same rules gate the pages (`src/app/adam/page.tsx` and
`src/app/approvals/page.tsx`, both through `StudioAccessGate`) and the studio APIs
(`requireStudioOrAdamAuth`). Nothing renders in the editor shell until the server
gate passes.

## Configuration

```bash
# Extra wallets (comma-separated). Owner wallet is always allowed.
ADAM_STUDIO_ALLOWED_WALLETS=0x...,0x...

# off (default) | creator_pass
ADAM_STUDIO_MEMBERSHIP_ACCESS=off

# Optional overrides
CREATOR_PASS_LOCK_ADDRESS=0xf7c4cd399395d80f9d61fde833849106775269c6
CREATOR_PASS_CHAIN_ID=8453
CREATOR_PASS_RPC_URL=            # defaults to Alchemy (ALCHEMY_API_KEY) then mainnet.base.org
```

To grant a teammate access: add their wallet to `ADAM_STUDIO_ALLOWED_WALLETS` and
redeploy. Removing it revokes access on the next request (membership cache is at
most 60s).

## Opening the studio to members

1. Set `ADAM_STUDIO_MEMBERSHIP_ACCESS=creator_pass`.
2. Ship per-member scoping first — this is the part that is **not built yet**:
   - `subscriptions` / `writers` rows keyed by the linked wallet,
   - studio queries filtered by that key (no shared "owner" post list),
   - approvals/metrics/payouts staying owner-only.
   Today a pass holder who got past the page gate would still be rejected by the
   admin-only studio APIs, so flipping the flag early is safe but useless.
3. Keep the allowlist for the owner and staff; it is the break-glass path.

`resolveAdamStudioAccess` returns the granting wallet (`decision.wallet`) so the
future tenant layer can use it as the account key.

## Studio Key fallback

`POST /api/adam/studio-key` with `{ "token": "<ADAM_API_TOKEN>" }` sets
`dear_creative_studio_key` (httpOnly, SameSite=Lax, 12h). The page gate and the
APIs both compare it in constant time. `DELETE` clears it. This preserves the old
localStorage flow for machines without a Privy session; the client still mirrors
the key into localStorage so its bearer-based fetch helper keeps working.

## Tests

```bash
npx vitest run src/lib/adam src/app/api/adam/studio-key
```

- `studio-access.test.ts` — allowlist parsing, decision order, flag parsing.
- `creator-pass.test.ts` — reader, caching, fail-closed behavior.
- `studio-access-server.test.ts` — signed-out, allowlist, member gating, admin.
- `studio-key/route.test.ts` — cookie issuance and rejection.
