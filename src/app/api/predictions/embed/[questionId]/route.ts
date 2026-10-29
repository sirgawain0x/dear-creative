import { NextResponse } from "next/server";
import { fetchPredictionEmbedCached } from "@/lib/predictions/fetch-prediction-embed";
import { parseCreativeTvPredictionUrl } from "@/lib/predictions/creative-tv-prediction-link";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { questionId } = await context.params;
  const url = new URL(request.url);
  const viewParam = url.searchParams.get("viewUrl")?.trim();
  const parsedFromParam = viewParam
    ? parseCreativeTvPredictionUrl(viewParam)
    : null;
  const viewUrl =
    parsedFromParam?.viewUrl ??
    viewParam ??
    `https://tv.creativeplatform.xyz/predict/${questionId}`;

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
