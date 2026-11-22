import { Suspense } from "react";
import { StudioAccessGate } from "@/app/adam/studio-access-gate";
import { STUDIO_PAGE_MAIN_CLASS } from "@/app/adam/studio-page-main-class";

export const instant = false;

export default function ApprovalsPage() {
  return (
    <main className={STUDIO_PAGE_MAIN_CLASS}>
      <Suspense
        fallback={
          <div className="min-w-0 w-full">
            <p className="text-zinc-500">Loading approvals…</p>
          </div>
        }
      >
        <StudioAccessGate initialTab="approvals" />
      </Suspense>
    </main>
  );
}
