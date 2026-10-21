import { notFound } from "next/navigation";
import { isAuthorProfilesEnabled } from "./feature-flag";

/** Server components / layouts: 404 when author profiles are disabled. */
export function ensureAuthorProfilesEnabled(): void {
  if (!isAuthorProfilesEnabled()) {
    notFound();
  }
}
