import { notFound } from "next/navigation";
import { isCowritersEnabled } from "@/lib/cowriters/feature-flag";
import AcceptCowriterInviteClient from "./accept-cowriter-invite-client";

export default function AcceptCowriterInvitePage() {
  if (!isCowritersEnabled()) {
    notFound();
  }
  return <AcceptCowriterInviteClient />;
}
