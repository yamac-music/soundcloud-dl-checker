import { createServer } from "node:http";

const DEFAULT_PORT = 8787;
const SUPPORTED_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"]);

const port = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT;
const EXTERNAL_DOWNLOAD_HOSTS = new Set([
  "hypeddit.com",
  "www.hypeddit.com",
  "toneden.io",
  "www.toneden.io",
  "pumpyoursound.com",
  "www.pumpyoursound.com",
  "dropbox.com",
  "www.dropbox.com",
  "drive.google.com",
  "mediafire.com",
  "www.mediafire.com"
]);
const SOUNDCLOUD_GATE_HOSTS = new Set(["gate.sc", "www.gate.sc"]);

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
  const downloadLinks = [
    ...extractDownloadLinks(hydrationTrack?.description, "description"),
    ...extractBuyLinks(hydrationTrack?.purchase_url),
    ...extractBuyAnchorDownloadLinks(html)
  ];
  const uniqueDownloadLinks = dedupeDownloadLinks(downloadLinks);
  const hasBuyDownloadLink = uniqueDownloadLinks.some((link) => link.source === "buy_link" && link.kind === "download");
  const hasExternalDownloadLink = uniqueDownloadLinks.some((link) => link.source === "description" && link.kind === "download");
  const hasUnverifiedBuyLink = uniqueDownloadLinks.some((link) => link.kind === "unverified_buy_link");
  const effectiveRawFlag =
    rawFlag === true
      ? true
      : hasBuyDownloadLink
        ? "buy_link"
        : hasExternalDownloadLink
          ? "external_link"
          : hasUnverifiedBuyLink
            ? "buy_link_unverified"
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
        : effectiveRawFlag === "buy_link_unverified"
          ? "needs_review"
        : effectiveRawFlag === false
          ? "not_downloadable"
          : "unknown",
    rawFlag: effectiveRawFlag,
    downloadLinks: uniqueDownloadLinks
  };
}

function extractDownloadLinks(value, source) {
  if (!value) {
    return [];
  }

  const matches = decodeHtmlEntity(value).match(/https?:\/\/[^\s<>"']+/gi) || [];
  const links = [];

  for (const match of matches) {
    const url = normalizeDownloadUrl(match);

    if (url) {
      links.push({ kind: "download", source, url });
    }
  }

  return links;
}

function extractBuyLinks(value) {
  if (!value) {
    return [];
  }

  const matches = decodeHtmlEntity(value).match(/https?:\/\/[^\s<>"']+/gi) || [];
  const links = [];

  for (const match of matches) {
    const normalized = normalizeBuyUrl(match);

    if (normalized) {
      links.push({
        kind: normalized.isDownloadHost ? "download" : "unverified_buy_link",
        source: "buy_link",
        url: normalized.url
      });
    }
  }

  return links;
}

function normalizeDownloadUrl(value) {
  const normalized = normalizeUrl(value);
  return normalized?.isDownloadHost ? normalized.url : null;
}

function normalizeBuyUrl(value) {
  return normalizeUrl(value);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value.replace(/[),.;!?]+$/g, ""));

    if (SOUNDCLOUD_GATE_HOSTS.has(url.hostname)) {
      const nestedUrl = url.searchParams.get("url");
      return nestedUrl ? normalizeUrl(nestedUrl) : null;
    }

    return {
      isDownloadHost: EXTERNAL_DOWNLOAD_HOSTS.has(url.hostname),
      url: url.toString()
    };
  } catch {
    return null;
  }
}

function dedupeDownloadLinks(links) {
  const seen = new Set();
  const uniqueLinks = [];

  for (const link of links) {
    if (seen.has(link.url)) {
      continue;
    }

    seen.add(link.url);
    uniqueLinks.push(link);
  }

  return uniqueLinks;
}

function extractBuyAnchorDownloadLinks(html) {
  const anchors = html.match(/<a\b[^>]*>.*?<\/a>/gis) || [];
  const links = [];

  for (const anchor of anchors) {
    const text = stripHtml(anchor).toLowerCase();
    const href = readHtmlAttribute(anchor, "href");

    if (!text.includes("buy")) {
      continue;
    }

    links.push(...extractBuyLinks(href));
  }

  return links;
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
    .replace(/&gt;/g, ">")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (match, hexadecimal, decimal) => {
      const encodedCodePoint = hexadecimal ?? decimal;

      if (!encodedCodePoint) {
        return match;
      }

      const codePoint = Number.parseInt(encodedCodePoint, hexadecimal ? 16 : 10);

      if (codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return match;
      }

      return String.fromCodePoint(codePoint);
    });
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
