import { MetadataSnapshot } from "@/types/history";
import { normalizeUrlCandidate } from "@/services/url";

function decodeHtmlEntity(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaTag(html: string, key: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? decodeHtmlEntity(match[1]) : null;
}

function findJsonBoolean(html: string, key: string) {
  const pattern = new RegExp(`"${key}":(true|false)`, "i");
  const match = html.match(pattern);

  if (!match) {
    return "missing" as const;
  }

  return match[1] === "true";
}

export async function resolveSoundCloudUrl(sourceUrl: string) {
  const normalizedUrl = normalizeUrlCandidate(sourceUrl);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
    });

    return response.url || normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

export async function fetchSoundCloudMetadata(resolvedUrl: string): Promise<MetadataSnapshot> {
  try {
    const response = await fetch(resolvedUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();
    const rawFlag = findJsonBoolean(html, "downloadable");

    return {
      title: findMetaTag(html, "og:title") || findMetaTag(html, "twitter:title"),
      artist:
        findMetaTag(html, "soundcloud:creator") ||
        findMetaTag(html, "twitter:audio:artist_name") ||
        findMetaTag(html, "author"),
      artworkUrl: findMetaTag(html, "og:image"),
      status:
        rawFlag === true
          ? "downloadable"
          : rawFlag === false
            ? "not_downloadable"
            : "unknown",
      rawFlag
    };
  } catch {
    return {
      title: null,
      artist: null,
      artworkUrl: null,
      status: "unknown",
      rawFlag: "fetch_failed"
    };
  }
}

