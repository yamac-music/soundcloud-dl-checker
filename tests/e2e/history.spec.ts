import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "soundcloud-dl-checker:history:v1";

test("判定履歴を保存し、再読み込みと同一曲の更新後も1件に保つ", async ({ page }) => {
  let responseCount = 0;
  await mockCheckApi(page, () => {
    responseCount += 1;
    return responseCount === 1
      ? checkResponse({ title: "First title", status: "downloadable" })
      : checkResponse({ title: "Updated title", status: "not_downloadable", downloadLinks: [] });
  });

  await page.goto("/");
  await runCheck(page, "https://on.soundcloud.com/short-link?si=first");

  await expect(page.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();
  await expect(page.getByRole("link", { name: /First title/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /First title/ })).toHaveAttribute(
    "href",
    "https://soundcloud.com/example/track"
  );
  await expect(page.getByRole("link", { name: /説明欄を開く/ })).toHaveAttribute("href", "https://hypeddit.com/example");

  const storedEntry = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]")[0], STORAGE_KEY);
  expect(storedEntry).toMatchObject({
    resolvedUrl: "https://soundcloud.com/example/track",
    title: "First title",
    artist: "Example artist",
    artworkUrl: "https://i1.sndcdn.com/artworks-example-large.jpg",
    status: "downloadable",
    rawFlag: "external_link"
  });

  await page.reload();
  await expect(page.getByRole("link", { name: /First title/ })).toBeVisible();

  await runCheck(page, "https://www.soundcloud.com/example/track/?utm_source=share");
  await expect(page.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Updated title/ })).toBeVisible();
  await expect(page.getByText("× DL不可")).toBeVisible();

  const storedCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]").length, STORAGE_KEY);
  expect(storedCount).toBe(1);
});

test("101曲目の追加時に最も古い履歴を削除する", async ({ page }) => {
  await mockCheckApi(page, () => checkResponse({ title: "Newest track" }));

  await page.goto("/");
  await seedHistory(page, 100);
  await page.reload();
  await expect(page.getByRole("heading", { name: "判定履歴（100件）" })).toBeVisible();
  await runCheck(page, "https://soundcloud.com/example/newest");

  await expect(page.getByRole("heading", { name: "判定履歴（100件）" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Newest track/ })).toBeVisible();
  await expect(page.locator(".history-item").first()).toContainText("Newest track");
  await expect(page.getByRole("link", { name: /Track 0/ })).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".history-item")).toHaveCount(100);
  await expect(page.getByRole("link", { name: /Track 0/ })).toHaveCount(0);
});

test("履歴を個別削除し、確認後に全削除する", async ({ page }) => {
  await page.goto("/");
  await seedHistory(page, 2);
  await page.reload();

  await expect(page.locator(".history-item").first()).toContainText("Track 1");
  await expect(page.getByText("⚠ 要確認")).toBeVisible();
  await expect(page.getByText("? 判定不能")).toBeVisible();
  await expect(page.getByRole("link", { name: /Track 1/ })).toHaveAttribute(
    "href",
    "https://soundcloud.com/example/track-1"
  );

  await page.getByRole("button", { name: "Track 1の履歴を削除" }).click();
  await expect(page.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "全削除" }).click();
  await expect(page.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "全削除" }).click();
  await expect(page.getByText("判定履歴はまだありません。")).toBeVisible();

  await page.reload();
  await expect(page.getByText("判定履歴はまだありません。")).toBeVisible();
});

test("保存データが壊れていても判定できる", async ({ page }) => {
  await page.addInitScript(
    ({ key }) => localStorage.setItem(key, "{broken-json"),
    { key: STORAGE_KEY }
  );
  await mockCheckApi(page, () => checkResponse({ title: "Recovered track" }));

  await page.goto("/");
  await runCheck(page, "https://soundcloud.com/example/recovered");

  await expect(page.getByRole("heading", { name: "判定結果" })).toBeVisible();
  await expect(page.getByText("Recovered track").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();
});

test("履歴を書き込めなくても判定結果を表示する", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (itemKey, value) {
      if (itemKey === key) {
        throw new DOMException("Storage disabled");
      }
      return originalSetItem.call(this, itemKey, value);
    };
  }, { key: STORAGE_KEY });
  await mockCheckApi(page, () => checkResponse({ title: "Visible result" }));

  await page.goto("/");
  await runCheck(page, "https://soundcloud.com/example/visible");

  await expect(page.getByText("Visible result").first()).toBeVisible();
  await expect(page.getByText("判定履歴をこのブラウザに保存できませんでした。")).toBeVisible();
});

test("同じブラウザの別タブで追加した履歴を相互に反映する", async ({ context, page }) => {
  const secondPage = await context.newPage();
  await mockCheckApi(page, () => checkResponse({
    resolvedUrl: "https://soundcloud.com/example/track-a",
    title: "Track A"
  }));
  await mockCheckApi(secondPage, () => checkResponse({
    resolvedUrl: "https://soundcloud.com/example/track-b",
    title: "Track B"
  }));

  await Promise.all([page.goto("/"), secondPage.goto("/")]);
  await runCheck(page, "https://soundcloud.com/example/track-a");

  await expect(secondPage.getByRole("heading", { name: "判定履歴（1件）" })).toBeVisible();
  await expect(secondPage.getByRole("link", { name: /Track A/ })).toBeVisible();

  await runCheck(secondPage, "https://soundcloud.com/example/track-b");

  for (const currentPage of [page, secondPage]) {
    await expect(currentPage.getByRole("heading", { name: "判定履歴（2件）" })).toBeVisible();
    await expect(currentPage.getByRole("link", { name: /Track A/ })).toBeVisible();
    await expect(currentPage.getByRole("link", { name: /Track B/ })).toBeVisible();
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "判定履歴（2件）" })).toBeVisible();
});

async function runCheck(page: Page, url: string) {
  await page.getByLabel("URLを貼り付け").fill(url);
  await page.getByRole("button", { name: "判定する" }).click();
  await expect(page.getByRole("button", { name: "判定する" })).toBeEnabled();
}

async function mockCheckApi(page: Page, response: () => object) {
  await page.route("**/api/soundcloud/check?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response())
    });
  });
}

function checkResponse({
  resolvedUrl = "https://soundcloud.com/example/track",
  title,
  status = "downloadable",
  downloadLinks = [
    {
      kind: "download",
      source: "description",
      url: "https://hypeddit.com/example"
    }
  ]
}: {
  resolvedUrl?: string;
  title: string;
  status?: "downloadable" | "not_downloadable";
  downloadLinks?: Array<{ kind: "download"; source: "description"; url: string }>;
}) {
  return {
    resolvedUrl,
    metadata: {
      title,
      artist: "Example artist",
      artworkUrl: "https://i1.sndcdn.com/artworks-example-large.jpg",
      status,
      rawFlag: status === "downloadable" ? "external_link" : false,
      downloadLinks
    }
  };
}

async function seedHistory(page: Page, count: number) {
  await page.evaluate(
    ({ key, entryCount }) => {
      const baseTime = Date.parse("2024-01-01T00:00:00.000Z");
      const entries = Array.from({ length: entryCount }, (_, index) => ({
        resolvedUrl: `https://www.soundcloud.com/example/track-${index}/?si=test`,
        title: `Track ${index}`,
        artist: "Example artist",
        artworkUrl: null,
        status: index === 0 ? "unknown" : index === 1 ? "needs_review" : "downloadable",
        rawFlag: index === 0 ? "missing" : index === 1 ? "buy_link_unverified" : true,
        downloadLinks: [],
        checkedAt: new Date(baseTime + index * 1000).toISOString()
      }));
      localStorage.setItem(key, JSON.stringify(entries));
    },
    { key: STORAGE_KEY, entryCount: count }
  );
}
