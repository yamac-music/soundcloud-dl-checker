import { expect, test } from "@playwright/test";

import { onRequestGet } from "../../functions/api/soundcloud/check";
import { parseSoundCloudMetadata } from "../../src/services/soundcloudParser";
import { isSoundCloudTrackUrl, normalizeUrlCandidate } from "../../src/services/url";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("トラックのURLだけを判定対象にする", () => {
  const track = (value: string) => isSoundCloudTrackUrl(normalizeUrlCandidate(value));

  expect(track("https://soundcloud.com/artist/track")).toBe(true);
  expect(track("https://m.soundcloud.com/artist/track?si=abc")).toBe(true);
  expect(track("soundcloud.com/artist/track/s-AbC123")).toBe(true);
  expect(track("https://soundcloud.com/artist/sets/playlist")).toBe(false);
  expect(track("https://soundcloud.com/artist")).toBe(false);
  expect(track("https://soundcloud.com/artist/tracks")).toBe(false);
  expect(track("https://soundcloud.com/discover/sets/weekly")).toBe(false);
});

test("hydrationにトラック本体がなければ、ページ内の別の曲のdownloadableを使わない", () => {
  const hydration = JSON.stringify([
    { hydratable: "user", data: { username: "artist" } },
    { hydratable: "playlist", data: { title: "Playlist", tracks: [{ downloadable: true, title: "First" }] } }
  ]);
  const metadata = parseSoundCloudMetadata(`<script>window.__sc_hydration = ${hydration};</script>`);

  expect(metadata.rawFlag).toBe("missing");
  expect(metadata.status).toBe("unknown");
});

test("プレイリストのURLはSoundCloudへ問い合わせずに断る", async () => {
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response("");
  }) as typeof fetch;

  const response = await callCheck("https://soundcloud.com/artist/sets/playlist");

  expect(response.status).toBe(400);
  expect(fetchCount).toBe(0);
});

test("他サイトのページからの呼び出しを断る", async () => {
  const response = await callCheck("https://soundcloud.com/artist/track", { "Sec-Fetch-Site": "cross-site" });

  expect(response.status).toBe(403);
});

test("短縮URLはリダイレクトを追い、トラックページを1回だけ取得する", async () => {
  const requested: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);

    if (url.startsWith("https://on.soundcloud.com/")) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://soundcloud.com/artist/track?si=abc&utm_source=share" }
      });
    }

    return new Response(trackHtml(true));
  }) as typeof fetch;

  const response = await callCheck("https://on.soundcloud.com/short");
  const body = (await response.json()) as { resolvedUrl: string; metadata: { status: string } };

  expect(response.status).toBe(200);
  expect(body.resolvedUrl).toBe("https://soundcloud.com/artist/track");
  expect(body.metadata.status).toBe("downloadable");
  expect(requested).toEqual([
    "https://on.soundcloud.com/short",
    "https://soundcloud.com/artist/track?si=abc&utm_source=share"
  ]);
});

test("SoundCloud以外へのリダイレクトは追わない", async () => {
  const requested: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input));
    return new Response(null, { status: 302, headers: { Location: "https://example.com/" } });
  }) as typeof fetch;

  const response = await callCheck("https://on.soundcloud.com/short");

  expect(response.status).toBe(502);
  expect(requested).toEqual(["https://on.soundcloud.com/short"]);
});

test("SoundCloudの404は404として返す", async () => {
  globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;

  const response = await callCheck("https://soundcloud.com/artist/deleted-track");

  expect(response.status).toBe(404);
});

function callCheck(url: string, headers: Record<string, string> = {}) {
  const request = new Request(`https://checker.example/api/soundcloud/check?url=${encodeURIComponent(url)}`, {
    headers
  });
  return onRequestGet({ request });
}

function trackHtml(downloadable: boolean) {
  const hydration = JSON.stringify([{ hydratable: "sound", data: { downloadable, title: "Example track" } }]);
  return `<script>window.__sc_hydration = ${hydration};</script>`;
}
