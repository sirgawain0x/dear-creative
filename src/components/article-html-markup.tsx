"use client";

import Script from "next/script";
import { memo, useCallback, useEffect, useRef } from "react";
import { linkCreativeTvDiscoverEmbeds } from "@/lib/html/creative-tv-discover";

type XWidgets = {
  widgets?: { load: (container: HTMLElement) => void };
};

/** Renders prepared article HTML and upgrades its X post placeholders. */
export const ArticleHtmlMarkup = memo(function ArticleHtmlMarkup({
  html,
  className = "prose prose-zinc dark:prose-invert max-w-none",
}: {
  html: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const hasXPosts = /class="[^"]*\btwitter-tweet\b/.test(html);
  const loadXPosts = useCallback(() => {
    const body = container.current;
    const widgets = (window as Window & { twttr?: XWidgets }).twttr?.widgets;
    if (body?.querySelector("blockquote.twitter-tweet")) {
      widgets?.load(body);
    }
  }, []);

  useEffect(() => {
    if (hasXPosts) loadXPosts();
  }, [hasXPosts, html, loadXPosts]);

  return (
    <>
      <div
        ref={container}
        className={className}
        dangerouslySetInnerHTML={{ __html: linkCreativeTvDiscoverEmbeds(html) }}
      />
      {hasXPosts ? (
        <Script src="https://platform.x.com/widgets.js" onReady={loadXPosts} />
      ) : null}
    </>
  );
});
