import { NextResponse } from "next/server";
import { fetchPredictionEmbedCached } from "@/lib/predictions/fetch-prediction-embed";
import { resolveTrustedPredictionViewUrl } from "@/lib/predictions/creative-tv-prediction-link";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { questionId } = await context.params;
  const url = new URL(request.url);
  const viewParam = url.searchParams.get("viewUrl")?.trim();
  // Never trust a raw viewUrl: it must be a Creative TV prediction link for
  // this exact question, otherwise use the canonical TV URL.
  const viewUrl = resolveTrustedPredictionViewUrl(questionId, viewParam);

  const result = await fetchPredictionEmbedCached(questionId, viewUrl);

  if (!result.ok) {
    return NextResponse.json(result, {
      status: 404,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
