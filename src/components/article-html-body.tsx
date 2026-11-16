import { preparePostBodyHtmlForRender } from "@/lib/posts/body-html-for-render";
import { ArticleHtmlMarkup } from "./article-html-markup";

type ArticleHtmlBodyProps = {
  bodyHtml: string | null | undefined;
  className?: string;
};

/**
 * Renders imported archive `body_html` from the database. All call sites must
 * use this component (or `preparePostBodyHtmlForRender`) — never raw HTML.
 */
export function ArticleHtmlBody({ bodyHtml, className }: ArticleHtmlBodyProps) {
  const safeHtml = preparePostBodyHtmlForRender(bodyHtml);
  if (!safeHtml) {
    return null;
  }
  return <ArticleHtmlMarkup html={safeHtml} className={className} />;
}
