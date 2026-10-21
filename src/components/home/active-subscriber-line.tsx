import { connection } from "next/server";
import { ActiveSubscriberLineContent } from "@/components/home/active-subscriber-line-content";
import { getPublicActiveSubscriberCount } from "@/lib/subscribers/get-public-active-subscriber-count";

export async function ActiveSubscriberLine() {
  await connection();
  const count = await getPublicActiveSubscriberCount();
  if (count === null) {
    return null;
  }

  return <ActiveSubscriberLineContent count={count} />;
}
