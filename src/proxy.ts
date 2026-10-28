import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyPreviewRouteResponseHeaders } from "@/lib/preview-links/preview-response-headers";
import {
  pageNotFoundProxyResponse,
  resolvePageNotFoundProxy,
} from "@/lib/routing/page-not-found-proxy";

const PROXY_METHODS = new Set(["GET", "HEAD"]);

export async function proxy(request: NextRequest) {
  if (!PROXY_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isPreviewRoute = pathname.startsWith("/preview/");

  const decision = await resolvePageNotFoundProxy(pathname);
  const blocked = pageNotFoundProxyResponse(decision, request);
  const response = blocked ?? NextResponse.next();
  if (isPreviewRoute) {
    return applyPreviewRouteResponseHeaders(response);
  }
  return response;
}

export const config = {
  matcher: ["/posts/:path*", "/authors/:path*", "/preview/:path*"],
};
