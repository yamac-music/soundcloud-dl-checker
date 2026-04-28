const SUPPORTED_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"]);
const SOUNDCLOUD_HOST = "soundcloud.com";
const SHORT_SOUNDCLOUD_HOST = "on.soundcloud.com";

export function normalizeUrlCandidate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Enter a SoundCloud URL.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("Only public SoundCloud URLs are supported.");
  }

  url.hostname = canonicalSoundCloudHost(url.hostname);
  url.hash = "";
  url.search = "";

  return url.toString();
}

export function isShortSoundCloudUrl(url: string) {
  return new URL(url).hostname === SHORT_SOUNDCLOUD_HOST;
}

function canonicalSoundCloudHost(hostname: string) {
  return hostname === "www.soundcloud.com" ? SOUNDCLOUD_HOST : hostname;
}
