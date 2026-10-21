import { AdamStudio } from "./adam-studio";
import { STUDIO_PAGE_MAIN_CLASS } from "./studio-page-main-class";

export default function AdamPage() {
  return (
    <main className={STUDIO_PAGE_MAIN_CLASS}>
      <AdamStudio initialTab="chat" />
    </main>
  );
}
