import type { User } from "@privy-io/server-auth";
import { getPrivyServerClient } from "@/lib/privy/server-client";
import { verifyPrivyAccessToken } from "@/lib/privy/verify";
import type { CowriterAcceptIdentity } from "./accept-invite";

function isWalletAccount(
  account: User["linkedAccounts"][number],
): account is User["linkedAccounts"][number] & { address: string } {
  return (
    account.type === "wallet" &&
    "address" in account &&
    typeof account.address === "string"
  );
}

export function privyUserToAcceptIdentity(user: User): CowriterAcceptIdentity {
  const emails: string[] = [];
  if (user.email?.address) {
    emails.push(user.email.address);
  }
  for (const account of user.linkedAccounts) {
    if (account.type === "email" && "address" in account) {
      const address = account.address;
      if (typeof address === "string") {
        emails.push(address);
      }
    }
  }

  const wallets = user.linkedAccounts
    .filter(isWalletAccount)
    .map((account) => account.address);

  if (user.wallet?.address) {
    wallets.push(user.wallet.address);
  }

  return { emails, wallets };
}

export async function resolveCowriterAcceptIdentityFromToken(
  token: string,
): Promise<CowriterAcceptIdentity | null> {
  const client = getPrivyServerClient();
  if (!client) {
    return null;
  }
  const claims = await verifyPrivyAccessToken(token);
  const user = await client.getUserById(claims.userId);
  if (!user) {
    return null;
  }
  return privyUserToAcceptIdentity(user);
}
