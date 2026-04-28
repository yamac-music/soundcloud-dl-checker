import { MetadataSnapshot } from "@/types/soundcloud";
import { normalizeUrlCandidate } from "@/services/url";
import { parseSoundCloudMetadata } from "@/services/soundcloudParser";

interface SoundCloudCheckResult {
  resolvedUrl: string;
  metadata: MetadataSnapshot;
}

export async function checkSoundCloudUrl(sourceUrl: string): Promise<SoundCloudCheckResult> {
  const normalizedUrl = normalizeUrlCandidate(sourceUrl);
  return checkSoundCloudUrlWithProxy(normalizedUrl);
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

    return parseSoundCloudMetadata(await response.text());
  } catch {
    return {
      title: null,
      artist: null,
      artworkUrl: null,
      status: "unknown",
      rawFlag: "fetch_failed",
      downloadLinks: []
    };
  }
}

async function checkSoundCloudUrlWithProxy(sourceUrl: string): Promise<SoundCloudCheckResult> {
  const endpoint = `${getWebProxyBaseUrl()}/api/soundcloud/check?url=${encodeURIComponent(sourceUrl)}`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    throw new Error("判定用APIに接続できません。ローカル開発では別ターミナルで npm run web:metadata-proxy を起動してください。");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || "判定用APIでエラーが発生しました。");
  }

  return response.json() as Promise<SoundCloudCheckResult>;
}

function getWebProxyBaseUrl() {
  if (typeof window !== "undefined" && window.location.hostname) {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return window.location.origin;
    }

    return `${window.location.protocol}//${window.location.hostname}:8787`;
  }

  return "http://127.0.0.1:8787";
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return null;
  }
}
