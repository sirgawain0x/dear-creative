# Reader per-post USDC unlock (PR C)

## Feature flags

Reader paywall APIs and `isPaywallEnabled()` are active only when **both** env vars are exactly the string `true`:

- `PAYWALL_ENABLED=true`
- `PAYMENTS_ENABLED=true`

If either is unset or any other value, paywall reader routes return **404** (same as paywall off).

## Payment verification

- **Identity:** Privy-linked **signer** EOA (same as admin subscription checkout).
- **Payer on-chain:** Receipt verification accepts USDC `Transfer` from the signer **or** the signer’s **Alchemy modular smart account** (predicted server-side via `@alchemy/smart-accounts`, same salt as subscription checkout).
- **Amount:** Exact match to quoted `unlockAmountRaw` (default $1 USDC, 6 decimals).

## Gated audio

When paywall is on, reader-facing `audioUrl` for gated posts is always `/api/posts/{slug}/audio`, never a raw Grove/CDN URL. The route enforces entitlement before returning stored narration metadata.
