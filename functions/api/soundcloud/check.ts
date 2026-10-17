import { CheckError, checkSoundCloud, validateSourceUrl } from "../../../src/server/soundcloudCheck";

// 同じ曲の判定結果をエッジに残す秒数。連続した再判定でSoundCloudへ何度も問い合わせないようにする
const CACHE_TTL_SECONDS = 10 * 60;

interface CheckContext {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export async function onRequestGet({ request, waitUntil }: CheckContext) {
  // このAPIは同じサイトの画面からだけ使う。他サイトのページから呼ばれた場合は断る
  if (isCrossSiteRequest(request)) {
    return sendJson(403, { error: "このAPIは SoundCloud DL Checker の画面からだけ利用できます。" });
  }

  let sourceUrl: string;

  try {
    sourceUrl = validateSourceUrl(new URL(request.url).searchParams.get("url") || "");
  } catch (error) {
    return sendError(error);
  }

  const cache = getEdgeCache();
  const cacheKey = new Request(buildCacheKeyUrl(request.url, sourceUrl));
  const cached = await cache?.match(cacheKey);

  if (cached) {
    return cached;
  }

  let response: Response;

  try {
    response = sendJson(200, await checkSoundCloud(sourceUrl), CACHE_TTL_SECONDS);
  } catch (error) {
    response = sendError(error);
  }

  // 成功と「曲が見つからない」だけを残す。一時的な失敗は残さず、次の判定で取り直す
  if (cache && (response.status === 200 || response.status === 404)) {
    const stored = cache.put(cacheKey, response.clone());
    waitUntil ? waitUntil(stored) : await stored;
  }

  return response;
}

function isCrossSiteRequest(request: Request) {
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none";
}

function buildCacheKeyUrl(requestUrl: string, sourceUrl: string) {
  const key = new URL("/api/soundcloud/check", requestUrl);
  key.searchParams.set("url", sourceUrl);
  return key.toString();
}

function getEdgeCache() {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default ?? null;
}

function sendError(error: unknown) {
  if (error instanceof CheckError) {
    return sendJson(error.status, { error: error.message }, error.status === 404 ? CACHE_TTL_SECONDS : 0);
  }

  return sendJson(500, { error: "判定中に予期しないエラーが発生しました。" });
}

function sendJson(status: number, payload: unknown, maxAgeSeconds = 0) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAgeSeconds > 0 ? `public, max-age=${maxAgeSeconds}` : "no-store"
    }
  });
}
