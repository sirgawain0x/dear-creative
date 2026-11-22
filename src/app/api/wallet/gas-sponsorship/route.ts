import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { resolveGasSponsorshipFromCookies } from "@/lib/wallet/gas-sponsorship";

const NO_STORE = "private, no-store";

/**
 * GET /api/wallet/gas-sponsorship
 *
 * Tells the client whether this viewer's gas is sponsored (active Creator Pass)
 * or self-paid, plus the ERC-20 policy config for smart-account sends.
 */
export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const decision = await resolveGasSponsorshipFromCookies(
    (name) => cookieStore.get(name)?.value,
  );

  return NextResponse.json(
    {
      mode: decision.mode,
      reason: decision.reason,
      wallet: decision.wallet,
      erc20: decision.erc20,
    },
    { headers: { "Cache-Control": NO_STORE } },
  );
}
