import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  pageNotFoundProxyResponse,
  resolvePageNotFoundProxy,
} from "@/lib/routing/page-not-found-proxy";

const PROXY_METHODS = new Set(["GET", "HEAD"]);

export async function proxy(request: NextRequest) {
  if (!PROXY_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.next();
  }

  const decision = await resolvePageNotFoundProxy(request.nextUrl.pathname);
  const blocked = pageNotFoundProxyResponse(decision, request);
  if (blocked) {
    return blocked;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/posts/:path*", "/authors/:path*"],
};
