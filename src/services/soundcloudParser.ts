import type { DownloadLink, DownloadLinkSource, MetadataSnapshot } from "@/types/soundcloud";

type HydrationTrack = {
  artwork_url?: string | null;
  description?: string | null;
  downloadable?: boolean;
  purchase_title?: string | null;
  purchase_url?: string | null;
  title?: string | null;
  user?: {
    username?: string | null;
  } | null;
};

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
const SOUNDCLOUD_GATE_HOSTS = new Set(["gate.sc", "www.gate.sc"]);

export function parseSoundCloudMetadata(html: string): MetadataSnapshot {
  const hydrationTrack = findHydrationTrack(html);
  const rawFlag =
    typeof hydrationTrack?.downloadable === "boolean"
      ? hydrationTrack.downloadable
      : findJsonBoolean(html, "downloadable");
  const downloadLinks = [
    ...extractDownloadLinks(hydrationTrack?.description, "description"),
    ...extractDownloadLinks(hydrationTrack?.purchase_url, "buy_link"),
    ...extractBuyAnchorDownloadLinks(html)
  ];
  const uniqueDownloadLinks = dedupeDownloadLinks(downloadLinks);
  const hasBuyDownloadLink = uniqueDownloadLinks.some((link) => link.source === "buy_link");
  const hasExternalDownloadLink = uniqueDownloadLinks.some((link) => link.source === "description");
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
    artworkUrl: findMetaTag(html, "og:image") || findMetaTag(html, "twitter:image") || hydrationTrack?.artwork_url || null,
    status:
      effectiveRawFlag === true || effectiveRawFlag === "external_link" || effectiveRawFlag === "buy_link"
        ? "downloadable"
        : effectiveRawFlag === false
          ? "not_downloadable"
          : "unknown",
    rawFlag: effectiveRawFlag,
    downloadLinks: uniqueDownloadLinks
  };
}

function extractDownloadLinks(value: string | null | undefined, source: DownloadLinkSource): DownloadLink[] {
  if (!value) {
    return [];
  }

  const matches = decodeHtmlEntity(value).match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const links: DownloadLink[] = [];

  for (const match of matches) {
    const url = normalizeDownloadUrl(match);

    if (url) {
      links.push({ source, url });
    }
  }

  return links;
}

function normalizeDownloadUrl(value: string): string | null {
  try {
    const url = new URL(value.replace(/[),.;!?]+$/g, ""));

    if (SOUNDCLOUD_GATE_HOSTS.has(url.hostname)) {
      const nestedUrl = url.searchParams.get("url");
      return nestedUrl ? normalizeDownloadUrl(nestedUrl) : null;
    }

    if (!EXTERNAL_DOWNLOAD_HOSTS.has(url.hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function dedupeDownloadLinks(links: DownloadLink[]) {
  const seen = new Set<string>();
  const uniqueLinks: DownloadLink[] = [];

  for (const link of links) {
    if (seen.has(link.url)) {
      continue;
    }

    seen.add(link.url);
    uniqueLinks.push(link);
  }

  return uniqueLinks;
}

function extractBuyAnchorDownloadLinks(html: string) {
  const anchors = html.match(/<a\b[^>]*>.*?<\/a>/gis) ?? [];
  const links: DownloadLink[] = [];

  for (const anchor of anchors) {
    const text = stripHtml(anchor).toLowerCase();
    const href = readHtmlAttribute(anchor, "href");

    if (!text.includes("buy")) {
      continue;
    }

    links.push(...extractDownloadLinks(href, "buy_link"));
  }

  return links;
}

function stripHtml(value: string) {
  return decodeHtmlEntity(value.replace(/<[^>]*>/g, ""));
}

function decodeHtmlEntity(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaTag(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const property = readHtmlAttribute(tag, "property") || readHtmlAttribute(tag, "name");

    if (property === key) {
      const content = readHtmlAttribute(tag, "content");
      return content ? decodeHtmlEntity(content) : null;
    }
  }

  return null;
}

function readHtmlAttribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const match = tag.match(pattern);
  return match ? match[2] : null;
}

function findJsonBoolean(html: string, key: string) {
  const pattern = new RegExp(`"${key}":(true|false)`, "i");
  const match = html.match(pattern);

  if (!match) {
    return "missing" as const;
  }

  return match[1] === "true";
}

function findHydrationTrack(html: string): HydrationTrack | null {
  const match = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);\s*<\/script>/s);

  if (!match) {
    return null;
  }

  try {
    const entries = JSON.parse(match[1]) as Array<{ data?: unknown; hydratable?: string }>;

    for (const entry of entries) {
      const data = entry.data;

      if (!data || typeof data !== "object") {
        continue;
      }

      if ("downloadable" in data && "title" in data) {
        return data as HydrationTrack;
      }
    }
  } catch {
    return null;
  }

  return null;
}
