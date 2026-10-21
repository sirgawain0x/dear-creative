import { connection } from "next/server";
import { formatActiveSubscriberCount } from "@/lib/subscribers/active-subscriber-count";
import { getPublicActiveSubscriberCount } from "@/lib/subscribers/get-public-active-subscriber-count";

export async function ActiveSubscriberLine() {
  await connection();
  const count = await getPublicActiveSubscriberCount();
  if (count === null) {
    return null;
  }

  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      Join {formatActiveSubscriberCount(count)} creatives reading Dear Creative
    </p>
  );
}
