import { createServer } from "node:http";

const DEFAULT_PORT = 8787;
const SUPPORTED_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"]);

const port = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT;
const EXTERNAL_DOWNLOAD_HOSTS = new Set([
  "hypeddit.com",
  "www.hypeddit.com",
  "toneden.io",
  "www.toneden.io",
  "theartistunion.com",
  "www.theartistunion.com",
  "artistunion.com",
  "www.artistunion.com",
  "dropbox.com",
  "www.dropbox.com",
  "drive.google.com",
  "mediafire.com",
  "www.mediafire.com"
]);

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (request.method !== "GET" || requestUrl.pathname !== "/api/soundcloud/check") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const sourceUrl = normalizeUrlCandidate(requestUrl.searchParams.get("url") || "");
    const resolvedUrl = await resolveSoundCloudUrl(sourceUrl);
    const html = await fetchSoundCloudHtml(resolvedUrl);
    const metadata = parseSoundCloudMetadata(html);

    sendJson(response, 200, {
      sourceUrl,
      resolvedUrl,
      metadata
    });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "SoundCloud check failed."
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SoundCloud metadata proxy listening on http://127.0.0.1:${port}`);
});

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function normalizeUrlCandidate(input) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Enter a SoundCloud URL.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("Only public SoundCloud URLs are supported.");
  }

  url.hostname = url.hostname === "www.soundcloud.com" ? "soundcloud.com" : url.hostname;
  url.hash = "";
  url.search = "";

  return url.toString();
}

async function resolveSoundCloudUrl(sourceUrl) {
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

async function fetchSoundCloudHtml(resolvedUrl) {
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

function parseSoundCloudMetadata(html) {
  const hydrationTrack = findHydrationTrack(html);
  const rawFlag =
    typeof hydrationTrack?.downloadable === "boolean"
      ? hydrationTrack.downloadable
      : findJsonBoolean(html, "downloadable");
  const hasBuyDownloadLink =
    hasDownloadLink(hydrationTrack?.purchase_url) || hasBuyAnchorDownloadLink(html);
  const hasExternalDownloadLink = hasDownloadLink(hydrationTrack?.description);
  const effectiveRawFlag =
    rawFlag === true
      ? true
      : hasBuyDownloadLink
        ? "buy_link"
        : hasExternalDownloadLink
          ? "external_link"
          : rawFlag;

  return {
    title:
      findMetaTag(html, "twitter:title") ||
      findMetaTag(html, "og:title") ||
      hydrationTrack?.title ||
      null,
    artist:
      findMetaTag(html, "soundcloud:creator") ||
      findMetaTag(html, "twitter:audio:artist_name") ||
      findMetaTag(html, "author") ||
      hydrationTrack?.user?.username ||
      null,
    artworkUrl:
      findMetaTag(html, "og:image") ||
      findMetaTag(html, "twitter:image") ||
      hydrationTrack?.artwork_url ||
      null,
    status:
      effectiveRawFlag === true || effectiveRawFlag === "external_link" || effectiveRawFlag === "buy_link"
        ? "downloadable"
        : effectiveRawFlag === false
          ? "not_downloadable"
          : "unknown",
    rawFlag: effectiveRawFlag
  };
}

function hasDownloadLink(description) {
  if (!description) {
    return false;
  }

  const matches = description.match(/https?:\/\/[^\s<>"']+/gi) || [];

  return matches.some((value) => {
    try {
      const url = new URL(value.replace(/[),.;!?]+$/g, ""));
      return EXTERNAL_DOWNLOAD_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  });
}

function hasBuyAnchorDownloadLink(html) {
  const anchors = html.match(/<a\b[^>]*>.*?<\/a>/gis) || [];

  return anchors.some((anchor) => {
    const text = stripHtml(anchor).toLowerCase();
    const href = readHtmlAttribute(anchor, "href");

    return text.includes("buy") && hasDownloadLink(href);
  });
}

function stripHtml(value) {
  return decodeHtmlEntity(value.replace(/<[^>]*>/g, ""));
}

function decodeHtmlEntity(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaTag(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const property = readHtmlAttribute(tag, "property") || readHtmlAttribute(tag, "name");

    if (property === key) {
      const content = readHtmlAttribute(tag, "content");
      return content ? decodeHtmlEntity(content) : null;
    }
  }

  return null;
}

function readHtmlAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const match = tag.match(pattern);
  return match ? match[2] : null;
}

function findJsonBoolean(html, key) {
  const pattern = new RegExp(`"${key}":(true|false)`, "i");
  const match = html.match(pattern);

  if (!match) {
    return "missing";
  }

  return match[1] === "true";
}

function findHydrationTrack(html) {
  const match = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);\s*<\/script>/s);

  if (!match) {
    return null;
  }

  try {
    const entries = JSON.parse(match[1]);

    for (const entry of entries) {
      const data = entry?.data;

      if (data && typeof data === "object" && "downloadable" in data && "title" in data) {
        return data;
      }
    }
  } catch {
    return null;
  }

  return null;
}
