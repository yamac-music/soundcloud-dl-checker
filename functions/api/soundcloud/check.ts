import { normalizeUrlCandidate } from "../../../src/services/url";
import { parseSoundCloudMetadata } from "../../../src/services/soundcloudParser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestGet(context: { request: Request }) {
  const requestUrl = new URL(context.request.url);

  try {
    const sourceUrl = normalizeUrlCandidate(requestUrl.searchParams.get("url") || "");
    const resolvedUrl = await resolveSoundCloudUrl(sourceUrl);
    const html = await fetchSoundCloudHtml(resolvedUrl);
    const metadata = parseSoundCloudMetadata(html);

    return sendJson(200, {
      sourceUrl,
      resolvedUrl,
      metadata
    });
  } catch (error) {
    return sendJson(400, {
      error: error instanceof Error ? error.message : "SoundCloud check failed."
    });
  }
}

function sendJson(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function resolveSoundCloudUrl(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    method: "GET",
    redirect: "follow",
    headers: buildSoundCloudHeaders()
  });

  if (!response.ok) {
    throw new Error(`SoundCloud returned HTTP ${response.status}.`);
  }

  return normalizeUrlCandidate(response.url || sourceUrl);
}

async function fetchSoundCloudHtml(resolvedUrl: string) {
  const response = await fetch(resolvedUrl, {
    method: "GET",
    headers: buildSoundCloudHeaders()
  });

  if (!response.ok) {
    throw new Error(`SoundCloud returned HTTP ${response.status}.`);
  }

  return response.text();
}

function buildSoundCloudHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
  };
}
