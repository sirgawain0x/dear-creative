import { notFound } from "next/navigation";

/**
 * Post reader metadata must not run during the prerender shell (no public site
 * origin yet). A sync notFound() here matches author profile routes and yields
 * a 404 shell template so request-time slug checks can return real HTTP 404.
 */
function isPostReaderMetadataShellPhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  if (phase === "phase-production-build" || phase === "phase-export") {
    return true;
  }
  return !process.env.NEXT_PUBLIC_SITE_URL?.trim();
}

export function gatePublishedPostReaderMetadataShell(): void {
  if (isPostReaderMetadataShellPhase()) {
    notFound();
  }
}
