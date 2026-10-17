const SUPPORTED_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"]);
const SOUNDCLOUD_HOST = "soundcloud.com";
const SHORT_SOUNDCLOUD_HOST = "on.soundcloud.com";

// soundcloud.com/<first>/... の <first> がユーザー名ではなく、サイトの機能ページを指すもの
const RESERVED_ROOT_PATHS = new Set([
  "charts",
  "discover",
  "imprint",
  "jobs",
  "messages",
  "mobile",
  "notifications",
  "pages",
  "people",
  "pro",
  "search",
  "settings",
  "stations",
  "stream",
  "tags",
  "terms-of-use",
  "upload",
  "you"
]);
// soundcloud.com/<user>/<second> の <second> がトラックではなく、プロフィールのタブやプレイリストを指すもの
const RESERVED_PROFILE_PATHS = new Set([
  "albums",
  "comments",
  "followers",
  "following",
  "likes",
  "popular-tracks",
  "reposts",
  "sets",
  "spotlight",
  "tracks"
]);

export const TRACK_URL_REQUIRED_MESSAGE =
  "トラック（1曲）のURLを入力してください。プレイリストやプロフィールのURLは判定できません。";

export function normalizeUrlCandidate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("SoundCloudのURLを入力してください。");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("URLの形式が正しくありません。");
  }

  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("SoundCloudの公開URLだけに対応しています。");
  }

  url.protocol = "https:";
  url.hostname = canonicalSoundCloudHost(url.hostname);
  url.hash = "";
  url.search = "";

  return url.toString();
}

export function isSupportedSoundCloudHost(hostname: string) {
  return SUPPORTED_HOSTS.has(hostname);
}

export function isShortSoundCloudUrl(url: string) {
  return new URL(url).hostname === SHORT_SOUNDCLOUD_HOST;
}

/**
 * 正規化済みURLが1曲のトラックページを指しているかを返す。
 * 対象は soundcloud.com/<user>/<track> と、限定公開の soundcloud.com/<user>/<track>/s-<token>。
 */
export function isSoundCloudTrackUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.hostname !== SOUNDCLOUD_HOST) {
    return false;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const [user, track, secretToken] = segments;

  if (!user || !track || RESERVED_ROOT_PATHS.has(user) || RESERVED_PROFILE_PATHS.has(track)) {
    return false;
  }

  return segments.length === 2 || (segments.length === 3 && /^s-[A-Za-z0-9]+$/.test(secretToken));
}

function canonicalSoundCloudHost(hostname: string) {
  return hostname === "www.soundcloud.com" || hostname === "m.soundcloud.com" ? SOUNDCLOUD_HOST : hostname;
}
