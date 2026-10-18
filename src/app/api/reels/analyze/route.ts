import { fail, mockResponse, ok, RequestMeta, fallbackToMock, requestUserId } from "@/lib/http";
import { analyzeImage, analyzeReelUrl, ReelUnsupportedError } from "@/lib/pipelines/imageAnalysis";
import { readChatRequest } from "@/lib/storage/attachments";

export const maxDuration = 60;

// POST /api/reels/analyze -> ReelAnalyzeResponse
//   JSON {user_id, attachments:[{type:"image", data_url|url}]}  (primary: a screenshot)
//   JSON {user_id, url}                                          (secondary: a TikTok link)
//   multipart with an `image` file
export async function POST(req: Request) {
  const mockReason = fallbackToMock();
  if (mockReason) return mockResponse("reels-analyze", "/api/reels/analyze", mockReason);
  const meta = new RequestMeta();
  try {
    const input = await readChatRequest(req);
    const userId = requestUserId(req, input.userId);
    const url = typeof input.extra.url === "string" ? input.extra.url : null;
    let analysis;
    if (input.images[0]) analysis = await analyzeImage(userId, input.images[0], meta);
    else if (url) analysis = await analyzeReelUrl(userId, url, meta);
    else return fail(400, "send an image (attachments or multipart `image`) or a reel `url`");
    return ok(
      { analysis_id: analysis.analysis_id, identified: analysis.identified, matches: analysis.matches, card: analysis.card },
      meta,
      "/api/reels/analyze",
      { matches: analysis.matches.length },
    );
  } catch (err) {
    if (err instanceof ReelUnsupportedError) return fail(422, err.message);
    console.error(err);
    return fail(500, err instanceof Error ? err.message : "analysis failed");
  }
}
