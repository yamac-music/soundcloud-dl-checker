# SoundCloud DL Checker

SoundCloudの公開トラックURLを貼り付けると、その曲をDLできそうな導線があるかを確認するWebアプリです。

[公開アプリを開く](https://soundcloud-dl-checker.pages.dev/)

判定には、SoundCloud公式のDL設定と、説明欄・Buy Linkに入っている外部DLリンクを使います。Buy Linkが対応サービス以外を指している場合は、ブログや特設サイトを経由している可能性があるため「要確認」として表示します。

## 開発の支援

このツールが役に立った場合は、開発と運営を支援できます。

[Buy me a coffee](https://buymeacoffee.com/yamac)

## 判定結果の見方

判定結果は次の4つのどれかです。

| 表示 | 値 | 判定の条件 |
| --- | --- | --- |
| ダウンロード可能 | `downloadable` | SoundCloud公式のDLが有効（`downloadable=true`）、または説明欄・Buy Linkに対応サービスのDLリンクがある |
| 要確認 | `needs_review` | Buy Linkが対応サービス以外のサイトを指している |
| ダウンロード不可 | `not_downloadable` | SoundCloud公式のDLが無効で、対応サービスのDLリンクも見つからない |
| 判定できません | `unknown` | ページの取得や解析に失敗した、または公開メタデータにDL設定が見つからない |

見つけた外部DLリンクは結果の下に表示され、スマホからもそのまま開けます。

## できること

### URLの受け取り

- SoundCloudのURLを手入力または貼り付けで受け取ります
- ページURLのクエリパラメータ `url=` からも受け取れます。`check=1` を付けると、読み込み後に自動で判定します（[URLパラメータ](#urlパラメータ)を参照）
- `on.soundcloud.com` の短縮URLは、元のトラックURLに解決してから判定します

### 判定

- SoundCloud公開ページのメタデータから `downloadable=true` かどうかを確認します
- 説明欄とBuy Linkから、対応サービスの外部DLリンクを検出します
- Buy Linkが対応サービス以外のサイトなら「要確認」にします

### 判定履歴

- 判定した曲を、新しい順に最大100曲までブラウザに保存します（詳しくは[判定履歴](#判定履歴-1)を参照）

## できないこと

- SoundCloud公式DLの100DL制限に達しているかどうかは判定しません
- 対応リストにない外部DLサイトは検出しません
- SoundCloudや外部サイトから音源ファイルを取得・保存しません
- 非公開APIは使いません
- 判定履歴はサーバーに保存しないため、端末やブラウザをまたいで同期しません

## 対応している外部DLリンク

説明欄またはBuy Linkに次のサービスのリンクが含まれていれば、外部DLリンクとして検出します。`www.` 付きのURLにも対応しています。

| 種類 | サービス | ドメイン |
| --- | --- | --- |
| DLゲートサイト | Hypeddit | `hypeddit.com` |
| DLゲートサイト | ToneDen | `toneden.io` |
| DLゲートサイト | Pump Your Sound | `pumpyoursound.com` |
| ファイル保存先 | Dropbox | `dropbox.com` |
| ファイル保存先 | Google Drive | `drive.google.com` |
| ファイル保存先 | MediaFire | `mediafire.com` |

Buy Linkにこれ以外のURLが入っている場合は、DL可能とは断定せず `needs_review` として扱います。

### gate.sc の扱い

`gate.sc` はファイルの保存先ではなく、SoundCloudが外部サイトへ移動するときに挟むURLです。リンクが `gate.sc` を経由している場合は、URL内の `url=` から移動先を取り出し、移動先が上の対応サービスなら検出します。

## 判定履歴

判定した曲ごとに、次の情報をブラウザの `localStorage` に保存します。

- 曲のURL、曲名、アーティスト名、アートワークURL
- 最新の判定結果と判定根拠
- 外部DLリンク
- 判定日時

保存するのは最大100曲で、上限を超えると最も古い履歴から削除します。

同じ曲を再判定した場合は、既存の履歴を最新の結果で上書きします。同じ曲かどうかは、短縮URLを解決し、URLを正規化してから比べます。

履歴は1件ずつ、またはまとめて削除できます。ブラウザのサイトデータを削除した場合も、履歴は消えます。

## URLパラメータ

ページURLにSoundCloudのURLを付けて開くと、入力欄にそのURLが入った状態になります。

```text
/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack
```

`check=1` を付けると、URLを読み込んだあと自動で判定を始めます。

```text
/?url=https%3A%2F%2Fon.soundcloud.com%2Fexample&check=1
```

SoundCloudの共有リンクに付く `?in=...`、`si=...`、`utm_*` などのクエリ文字列は、判定前に取り除き、トラック本体のURLにそろえます。

## 技術構成

- React
- TypeScript
- Vite
- Cloudflare Pages
- Cloudflare Pages Functions

SoundCloudのページはブラウザから直接取得しにくいため、ページの取得とメタデータの解析はサーバー側で行います。本番ではCloudflare Pages Function（`/api/soundcloud/check`）が、ローカル開発ではNodeのプロキシがこの処理を担当します。

### ファイル構成

| ファイル | 役割 |
| --- | --- |
| `src/App.tsx` | URL入力、判定の実行、結果と履歴の表示 |
| `src/styles.css` | 画面のスタイル |
| `src/services/url.ts` | URLの正規化と、SoundCloudのURLかどうかの確認 |
| `src/services/shareIntake.ts` | 文字列からSoundCloudのURLを取り出す |
| `src/services/soundcloud.ts` | 判定APIの呼び出し |
| `src/services/soundcloudParser.ts` | SoundCloudのHTMLからメタデータを解析する |
| `src/services/history.ts` | 判定履歴の保存・読み込み・削除 |
| `src/types/soundcloud.ts` | 判定に関する型定義 |
| `functions/api/soundcloud/check.ts` | 本番用の判定API（Cloudflare Pages Function） |
| `scripts/soundcloud-metadata-proxy.mjs` | ローカル開発用の判定API（Nodeプロキシ） |

## ローカル開発

### 1. 依存関係をインストールする

```sh
npm install
```

### 2. 判定用のプロキシを起動する

ローカルでは、判定APIとしてNodeのプロキシを使います。プロキシは `http://127.0.0.1:8787/api/soundcloud/check` で動きます。

```sh
npm run web:metadata-proxy
```

### 3. Webアプリを起動する

別のターミナルで次を実行します。

```sh
npm run dev
```

Viteが表示したURLをブラウザで開き、SoundCloudの公開トラックURLを貼り付けて「判定する」を押します。

### E2Eテスト

履歴の操作を含むブラウザ操作のE2Eテストを実行します。ローカルではGoogle Chromeを使います。

```sh
npm run test:e2e
```

### 本番用ビルドの確認

```sh
npm run build
```

## Cloudflare Pagesへのデプロイ

GitリポジトリからCloudflare Pagesのプロジェクトを作成し、次のように設定します。

```text
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22.16.0
```

`functions/` ディレクトリはCloudflare Pages Functionsとして自動で検出されます。本番のWebアプリは同じオリジンの `/api/soundcloud/check` を呼び出すため、追加の環境変数は要りません。

## 既知のリスク

- SoundCloudのHTML構造は変わる可能性があります。取得や解析に失敗した場合は `unknown` を返します。
- SoundCloud側のアクセス制限やHTML構造の変更によって、Cloudflare Pages Functionからの取得が失敗する可能性があります。
- 外部DLリンクの検出は、説明欄とBuy Linkに対応サービスのドメインがあるかどうかだけを見ています。リンク先で実際にDLできるかまでは確かめていません。
