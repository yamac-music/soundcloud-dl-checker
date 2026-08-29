import { expect, test } from "@playwright/test";

import { parseSoundCloudMetadata } from "../../src/services/soundcloudParser";

test("数値文字参照をデコードして同じ外部DLリンクを1件にまとめる", () => {
  const url = "https://drive.google.com/file/d/example/view?usp=sharing";
  const metadata = parseSoundCloudMetadata(
    createTrackHtml(url, [
      "https://drive.google.com/file/d/example/view?usp&#x3D;sharing",
      "https://drive.google.com/file/d/example/view?usp&#61;sharing"
    ])
  );

  expect(metadata.downloadLinks).toEqual([
    {
      kind: "download",
      source: "buy_link",
      url
    }
  ]);
  expect(metadata.status).toBe("downloadable");
});

test("異なる外部DLリンクは重複として除去しない", () => {
  const firstUrl = "https://drive.google.com/file/d/first/view?usp=sharing";
  const secondUrl = "https://drive.google.com/file/d/second/view?usp=sharing";
  const metadata = parseSoundCloudMetadata(createTrackHtml(firstUrl, [secondUrl]));

  expect(metadata.downloadLinks.map((link) => link.url)).toEqual([firstUrl, secondUrl]);
});

function createTrackHtml(purchaseUrl: string, anchorUrls: string[]) {
  const hydration = JSON.stringify([
    {
      hydratable: "sound",
      data: {
        downloadable: false,
        purchase_url: purchaseUrl,
        title: "Example track"
      }
    }
  ]);
  const anchors = anchorUrls.map((url) => `<a href="${url}">Buy</a>`).join("");

  return `<script>window.__sc_hydration = ${hydration};</script>${anchors}`;
}
