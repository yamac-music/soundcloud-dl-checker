import {
  isShortSoundCloudUrl,
  isSoundCloudTrackUrl,
  isSupportedSoundCloudHost,
  normalizeUrlCandidate,
  TRACK_URL_REQUIRED_MESSAGE
} from "../services/url";
import { parseSoundCloudMetadata } from "../services/soundcloudParser";
import type { MetadataSnapshot } from "../types/soundcloud";

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

export interface SoundCloudCheckResponse {
  sourceUrl: string;
  resolvedUrl: string;
  metadata: MetadataSnapshot;
}

export class CheckError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * 入力URLを検証して正規化する。トラックでも短縮URLでもなければ、SoundCloudへ問い合わせる前に弾く。
 */
export function validateSourceUrl(input: string) {
  let sourceUrl: string;

  try {
    sourceUrl = normalizeUrlCandidate(input);
  } catch (error) {
    throw new CheckError(error instanceof Error ? error.message : "URLを確認してください。", 400);
  }

  if (!isShortSoundCloudUrl(sourceUrl) && !isSoundCloudTrackUrl(sourceUrl)) {
    throw new CheckError(TRACK_URL_REQUIRED_MESSAGE, 400);
  }

  return sourceUrl;
}

/**
 * SoundCloudのトラックページを1回だけ取得し、DL可否のメタデータを返す。
 * 短縮URLのリダイレクトは同じ取得の中で追い、SoundCloud以外のホストへは移動しない。
 */
export async function checkSoundCloud(sourceUrl: string): Promise<SoundCloudCheckResponse> {
  const page = await fetchSoundCloudPage(sourceUrl);
  const resolvedUrl = normalizeUrlCandidate(page.url);

  if (!isSoundCloudTrackUrl(resolvedUrl)) {
    throw new CheckError(TRACK_URL_REQUIRED_MESSAGE, 400);
  }

  return {
    sourceUrl,
    resolvedUrl,
    metadata: parseSoundCloudMetadata(page.html)
  };
}

async function fetchSoundCloudPage(sourceUrl: string) {
  let currentUrl = sourceUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetchWithTimeout(currentUrl);
    const location = response.headers.get("Location");

    if (isRedirect(response.status) && location) {
      const nextUrl = new URL(location, currentUrl);

      if (!isSupportedSoundCloudHost(nextUrl.hostname)) {
        throw new CheckError("SoundCloud以外のサイトへ転送されたため、判定を中止しました。", 502);
      }

      currentUrl = nextUrl.toString();
      continue;
    }

    if (response.status === 404) {
      throw new CheckError("曲が見つかりません。削除されたか、非公開の可能性があります。", 404);
    }

    if (!response.ok) {
      throw new CheckError(`SoundCloudがHTTP ${response.status}を返しました。時間をおいて試してください。`, 502);
    }

    return { url: currentUrl, html: await response.text() };
  }

  throw new CheckError("SoundCloudの転送が多すぎるため、判定を中止しました。", 502);
}

async function fetchWithTimeout(url: string) {
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: buildSoundCloudHeaders(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new CheckError("SoundCloudの応答がないため、判定を中止しました。", 504);
    }

    throw new CheckError("SoundCloudに接続できませんでした。", 502);
  }
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function buildSoundCloudHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
  };
}
