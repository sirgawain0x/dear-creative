# Gas sponsorship and USDC gas

## The rule

| Wallet | Who pays gas | How |
| --- | --- | --- |
| Active **Creative Creator Pass** holder | Dear Creative | Privy gas sponsorship (`sponsor: true`) |
| Anyone else | The user | ETH today; USDC via Alchemy ERC-20 policy on smart-account sends |

The master switch is `PRIVY_EMBEDDED_GAS_SPONSORSHIP=true`. Even with it on,
`src/lib/wallet/gas-sponsorship.ts` only returns `mode: "sponsored"` when a
**linked wallet of the signed-in Privy user** answers `getHasValidKey()` on the
Creator Pass lock. The check fails closed (RPC error, timeout, signed out → self-paid).

Exposed to the client at `GET /api/wallet/gas-sponsorship` and through the
`useGasSponsorship()` hook. Applied in:

- Reader wallet USDC send (`reader-wallet-transactions.tsx`)
- Post unlock / tips checkout (`post-paywall-checkout.tsx`)
- Admin wallet send estimate + execute (`/api/admin/wallet/send*`)

## The ERC-20 policy

`ALCHEMY_ERC20_GAS_POLICY_ID` (currently `0200ae9b-ee40-48fb-9f36-1dda2fdde937`)
is an Alchemy **Gas Manager `erc20` policy** on Base. It lets a smart-account
UserOperation pay gas in **USDC** (`0x8335…2913`) instead of ETH.

**It cannot be attached to a Privy embedded EOA transaction.** Privy's embedded
`sendTransaction` only accepts `sponsor: true` (Privy's own paymaster); there is
no paymaster/policy hook for EOAs. ERC-20 gas requires an ERC-4337 / EIP-7702
smart account and a `paymaster` capability carrying the policy id.

## What shipping USDC gas requires

The proven pattern already runs in `crtv3` (`lib/wallet/smart-wallet-client.ts`,
`lib/wallet/gas-policy.ts`, `lib/hooks/wallet/useGasSponsorship.ts`):

1. `toViemAccount({ wallet })` on the Privy embedded wallet → viem signer.
2. `createSmartWalletClient({ signer, chain, transport: alchemyWalletTransport({ apiKey }) })`
   from `@alchemy/wallet-apis`.
3. `client.sendCalls({ calls, capabilities: { paymaster: { policyId } } })`
   - member → sponsorship policy id
   - non-member → ERC-20 policy id + `erc20: { tokenAddress: USDC }`
   - no policy → ETH fallback (user's own balance)

Two wallet models are possible with that stack:

- **EIP-7702** (Wallet API default): the user's existing EOA address is upgraded
  in place, so USDC already in the wallet is spendable. Privy exposes
  `useSign7702Authorization` for the authorization signature — needs an
  end-to-end test before relying on it.
- **Separate smart account** (`requestAccount`, what `crtv3` uses): new address;
  users must move USDC to it. No authorization signature needed, but it is a
  visible wallet migration.

This PR wires the policy decision and stops non-member sponsorship. The
smart-account transport is the next step and needs the wallet-model decision
above before any user funds are touched.

## Verifying a policy

Policy ids are not secrets, but only the Alchemy **Admin API token** can read it:

```
GET https://manage.g.alchemy.com/api/gasManager/policy/<policyId>
X-Alchemy-Token: <admin token from dashboard>
```

The app API key returns 401 there — that is expected.
