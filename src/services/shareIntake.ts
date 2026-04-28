import { IntakeRequest, IntakeSource } from "@/types/soundcloud";
import { normalizeUrlCandidate } from "@/services/url";

interface SharedPayload {
  webUrl?: string | null;
  text?: string | null;
  meta?: Record<string, string | undefined> | null;
}

const URL_CANDIDATE_PATTERN =
  /https?:\/\/[^\s<>"']+|(?:www\.)?(?:soundcloud\.com|on\.soundcloud\.com)\/[^\s<>"']+/gi;

export function buildIntakeRequest(url: string, source: IntakeSource = "manual"): IntakeRequest {
  return {
    source,
    url: normalizeUrlCandidate(url)
  };
}

export function buildShareSheetIntakeRequest(payload: SharedPayload): IntakeRequest {
  const url = extractSharedSoundCloudUrl(payload);

  if (!url) {
    throw new Error("Shared content did not include a SoundCloud URL.");
  }

  return buildIntakeRequest(url, "share_sheet");
}

export function extractSharedSoundCloudUrl(payload: SharedPayload) {
  const candidates = [
    payload.webUrl,
    payload.text,
    payload.meta?.url,
    payload.meta?.["og:url"],
    payload.meta?.["twitter:url"]
  ];

  for (const candidate of candidates) {
    const url = extractSoundCloudUrl(candidate);

    if (url) {
      return url;
    }
  }

  return null;
}

export function extractSoundCloudUrl(input?: string | null) {
  if (!input) {
    return null;
  }

  const direct = tryNormalizeUrl(input);

  if (direct) {
    return direct;
  }

  const matches = input.match(URL_CANDIDATE_PATTERN) ?? [];

  for (const match of matches) {
    const normalized = tryNormalizeUrl(match.replace(/[),.;!?]+$/g, ""));

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function tryNormalizeUrl(input: string) {
  try {
    return normalizeUrlCandidate(input);
  } catch {
    return null;
  }
}
