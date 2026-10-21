import { formatActiveSubscriberCount } from "@/lib/subscribers/active-subscriber-count";

export function ActiveSubscriberLineContent({ count }: { count: number }) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      Join {formatActiveSubscriberCount(count)} creatives reading Dear Creative
    </p>
  );
}
