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
      href: `https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}`,
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

export type ShareTriggerResult = "native" | "fallback" | "cancelled";

export type ShareEnvironment = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  matchMedia?: (query: string) => { matches: boolean };
};

export function wrapMenuFocusIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function isShareAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Browser env: share/canShare live on navigator; matchMedia is on window. */
export function createBrowserShareEnvironment():
  | ShareEnvironment
  | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  const nav = navigator;
  return {
    share: typeof nav.share === "function" ? nav.share.bind(nav) : undefined,
    canShare:
      typeof nav.canShare === "function" ? nav.canShare.bind(nav) : undefined,
    matchMedia:
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
        ? window.matchMedia.bind(window)
        : undefined,
  };
}

/** Native share only on coarse pointers when canShare accepts the payload. */
export function shouldUseNativeWebShare(
  data: ShareData,
  env: ShareEnvironment | undefined = globalThis.navigator as ShareEnvironment,
): boolean {
  if (typeof env?.share !== "function") {
    return false;
  }
  const coarsePointer =
    env.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  if (!coarsePointer) {
    return false;
  }
  return env.canShare?.(data) === true;
}

/** Uses Web Share on supported touch devices; otherwise invokes the fallback opener. */
export async function triggerPostShare(
  input: {
    title: string;
    url: string;
    onFallback: () => void;
  },
  env: ShareEnvironment | undefined = globalThis.navigator as ShareEnvironment,
): Promise<ShareTriggerResult> {
  const data: ShareData = { title: input.title, url: input.url };

  if (!shouldUseNativeWebShare(data, env)) {
    input.onFallback();
    return "fallback";
  }

  try {
    await env!.share!(data);
    return "native";
  } catch (error) {
    if (isShareAbortError(error)) {
      return "cancelled";
    }
    input.onFallback();
    return "fallback";
  }
}
