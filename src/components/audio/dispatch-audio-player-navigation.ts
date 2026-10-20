export type AnchorLike = {
  href: string;
  target: string;
  hasAttribute: (name: string) => boolean;
};

export type MouseEventLike = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

/**
 * Returns true when a primary same-origin link navigates away from the current path
 * (in-app navigation). Used to stop narration before the next page loads.
 */
export function shouldStopDispatchAudioForLinkClick(
  anchor: AnchorLike,
  currentHref: string,
): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  try {
    const currentUrl = new URL(currentHref);
    const destUrl = new URL(anchor.href, currentHref);
    return (
      destUrl.origin === currentUrl.origin &&
      destUrl.pathname !== currentUrl.pathname
    );
  } catch {
    return false;
  }
}

export function shouldIgnoreNavigationClick(event: MouseEventLike): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function findAnchorFromEventTarget(
  target: EventTarget | null,
): AnchorLike | null {
  if (!target || typeof target !== "object") return null;
  const el = target as { closest?: (sel: string) => AnchorLike | null };
  if (typeof el.closest !== "function") return null;
  return el.closest("a[href]") ?? null;
}

export function handleDispatchAudioDocumentClick(
  event: MouseEventLike,
  currentHref: string,
  onLeave: () => void,
): void {
  if (shouldIgnoreNavigationClick(event)) return;
  const anchor = findAnchorFromEventTarget(event.target);
  if (!anchor) return;
  if (shouldStopDispatchAudioForLinkClick(anchor, currentHref)) {
    onLeave();
  }
}
