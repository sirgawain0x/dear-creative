import { cookies } from "next/headers";
import { connection } from "next/server";
import { resolveAdamStudioAccessFromCookies } from "@/lib/adam/studio-access-server";
import { AdamStudio, type StudioTab } from "./adam-studio";
import { AdamStudioLocked } from "./studio-locked";

/**
 * Server gate shared by every private studio surface (/adam, /approvals).
 *
 * The editor only mounts when the viewer's linked wallet is allowlisted, holds
 * an active Creative Creator Pass (opt-in), is a Privy admin, or a valid Studio
 * Key cookie was presented. Everything else gets the locked screen.
 */
export async function StudioAccessGate({
  initialTab,
}: {
  initialTab: StudioTab;
}) {
  await connection();
  const cookieStore = await cookies();
  const { decision, membership } = await resolveAdamStudioAccessFromCookies(
    (name) => cookieStore.get(name)?.value,
  );

  if (!decision.allowed) {
    return (
      <AdamStudioLocked reason={decision.reason} membership={membership} />
    );
  }

  return <AdamStudio initialTab={initialTab} />;
}
