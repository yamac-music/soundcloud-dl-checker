const SUPPORTED_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"]);

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

  return url.toString();
}

export function isShortSoundCloudUrl(url: string) {
  return new URL(url).hostname === "on.soundcloud.com";
}

