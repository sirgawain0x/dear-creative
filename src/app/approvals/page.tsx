import { AdamStudio } from "@/app/adam/adam-studio";
import { STUDIO_PAGE_MAIN_CLASS } from "@/app/adam/studio-page-main-class";

export default function ApprovalsPage() {
  return (
    <main className={STUDIO_PAGE_MAIN_CLASS}>
      <AdamStudio initialTab="approvals" />
    </main>
  );
}
