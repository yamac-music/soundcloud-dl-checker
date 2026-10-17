import { MetadataSnapshot } from "@/types/soundcloud";
import { isShortSoundCloudUrl, isSoundCloudTrackUrl, normalizeUrlCandidate, TRACK_URL_REQUIRED_MESSAGE } from "@/services/url";

const CHECK_ENDPOINT = "/api/soundcloud/check";

interface SoundCloudCheckResult {
  resolvedUrl: string;
  metadata: MetadataSnapshot;
}

export async function checkSoundCloudUrl(sourceUrl: string): Promise<SoundCloudCheckResult> {
  const normalizedUrl = normalizeUrlCandidate(sourceUrl);

  // トラック以外のURLは、APIを呼ぶ前にここで止める
  if (!isShortSoundCloudUrl(normalizedUrl) && !isSoundCloudTrackUrl(normalizedUrl)) {
    throw new Error(TRACK_URL_REQUIRED_MESSAGE);
  }

  let response: Response;

  try {
    response = await fetch(`${CHECK_ENDPOINT}?url=${encodeURIComponent(normalizedUrl)}`, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    throw new Error("判定用APIに接続できません。通信状況を確認して、もう一度試してください。");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || "判定用APIでエラーが発生しました。");
  }

  return response.json() as Promise<SoundCloudCheckResult>;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return null;
  }
}
