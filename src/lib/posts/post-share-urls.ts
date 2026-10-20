export type ShareNetworkId =
  | "x"
  | "linkedin"
  | "facebook"
  | "farcaster"
  | "lens"
  | "bluesky"
  | "threads"
  | "whatsapp"
  | "reddit"
  | "email"
  | "copy";

export type ShareMenuItem =
  | {
      id: ShareNetworkId;
      label: string;
      kind: "link";
      href: string;
    }
  | {
      id: "copy";
      label: string;
      kind: "copy";
      url: string;
    };

/** Single-line share text used by networks that take a `text` query param. */
export function formatShareText(title: string, url: string): string {
  return `${title} ${url}`;
}

/** Builds outbound share targets with encodeURIComponent on every dynamic segment. */
export function buildPostShareMenuItems(input: {
  title: string;
  url: string;
}): ShareMenuItem[] {
  const { title, url } = input;
  const shareText = formatShareText(title, url);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(shareText);
  const encodedBody = encodeURIComponent(`${title}\n\n${url}`);

  return [
    {
      id: "x",
      label: "X",
      kind: "link",
      href: `https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      kind: "link",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      kind: "link",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "farcaster",
      label: "Farcaster",
      kind: "link",
      href: `https://farcaster.xyz/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`,
    },
    {
      id: "lens",
      label: "Lens",
      kind: "link",
      href: `https://hey.xyz/?text=${encodedText}`,
    },
    {
      id: "bluesky",
      label: "Bluesky",
      kind: "link",
      href: `https://bsky.app/intent/compose?text=${encodedText}`,
    },
    {
      id: "threads",
      label: "Threads",
      kind: "link",
      href: `https://www.threads.net/intent/post?text=${encodedText}`,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      kind: "link",
      href: `https://wa.me/?text=${encodedText}`,
    },
    {
      id: "reddit",
      label: "Reddit",
      kind: "link",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      id: "email",
      label: "Email",
      kind: "link",
      href: `mailto:?subject=${encodedTitle}&body=${encodedBody}`,
    },
    {
      id: "copy",
      label: "Copy link",
      kind: "copy",
      url,
    },
  ];
}

export type ShareTriggerResult = "native" | "fallback";

export type NavigatorShareLike = {
  share?: (data: ShareData) => Promise<void>;
};

/** Uses Web Share API when available; otherwise invokes the fallback opener. */
export async function triggerPostShare(
  input: {
    title: string;
    url: string;
    onFallback: () => void;
  },
  navigatorRef: NavigatorShareLike | undefined = globalThis.navigator,
): Promise<ShareTriggerResult> {
  const shareFn = navigatorRef?.share;
  if (typeof shareFn === "function") {
    await shareFn.call(navigatorRef, {
      title: input.title,
      url: input.url,
    });
    return "native";
  }
  input.onFallback();
  return "fallback";
}

export function isNativeShareAvailable(
  navigatorRef: NavigatorShareLike | undefined = globalThis.navigator,
): boolean {
  return typeof navigatorRef?.share === "function";
}
