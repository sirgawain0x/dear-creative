import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  pageNotFoundProxyResponse,
  resolvePageNotFoundProxy,
} from "@/lib/routing/page-not-found-proxy";

export async function proxy(request: NextRequest) {
  const decision = await resolvePageNotFoundProxy(request.nextUrl.pathname);
  const blocked = pageNotFoundProxyResponse(decision);
  if (blocked) {
    return blocked;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/posts/:path*", "/authors/:path*"],
};
