import { AdamStudio } from "./adam-studio";

export default function AdamPage() {
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1800px] px-4 sm:px-6 lg:px-8 py-10">
      <AdamStudio initialTab="chat" />
    </main>
  );
}
