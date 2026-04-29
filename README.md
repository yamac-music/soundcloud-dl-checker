# SoundCloud DL Checker

SoundCloudの公開トラックURLから、DLできそうな導線があるかを確認するWebアプリです。

SoundCloud公式のネイティブDL設定と、説明欄やBuy Linkに入っている外部DLリンクを見て判定します。
Buy Linkが既知のDLホスト以外を指している場合は、ブログや特設サイトなどの可能性があるため要確認として表示します。

## できること

- SoundCloud URLを手入力または貼り付けで受け取る
- ブラウザのクエリパラメータ `url=` からURLを受け取る
- `check=1` がある場合はURL読み込み後に自動で判定する
- `on.soundcloud.com` 短縮URLを解決する
- SoundCloud公開ページのメタデータから `downloadable=true` を確認する
- 説明欄やBuy Link内の既知の外部DLリンクを検出する
- Buy Link内の未知の外部サイトを要確認として表示する
- 見つけた外部DLリンクを結果に表示し、スマホから直接開けるようにする
- 結果は `downloadable` / `not_downloadable` / `needs_review` / `unknown` に分類する

## できないこと

- SoundCloudネイティブDLの100DL制限に達しているかどうかは判定しない
- 対応リストにない外部DLサイトは検出しない
- SoundCloudや外部サイトから音源ファイルを取得・保存しない
- 非公開APIの利用や、判定履歴の保存は行わない

## 対応している外部DLリンク

説明欄またはBuy Linkに次のリンクが含まれている場合、外部DLリンクとして検出します。`www.`付きのURLにも対応しています。
Buy Linkに下記以外のURLが入っている場合は、DL可能とは断定せず `needs_review` として扱います。

### DLゲートサイト

- Hypeddit: `hypeddit.com`
- ToneDen: `toneden.io`
- Pump Your Sound: `pumpyoursound.com`

### 保存先

- Dropbox: `dropbox.com`
- Google Drive: `drive.google.com`
- MediaFire: `mediafire.com`

### SoundCloudの外部遷移URL

`gate.sc` は保存先ではありません。SoundCloudの外部遷移URLとして使われている場合だけ、URL内の `url=` を展開し、展開先が上記の対応サービスなら検出します。

## Tech Stack

- React
- TypeScript
- Vite
- Cloudflare Pages
- Cloudflare Pages Functions

## Local Development

依存関係をインストールします。

```sh
npm install
```

判定用メタデータプロキシを起動します。

```sh
npm run web:metadata-proxy
```

別ターミナルでWebアプリを起動します。

```sh
npm run dev
```

Viteが表示したURLをブラウザで開き、SoundCloudの公開トラックURLを貼り付けて「判定する」を押します。

ローカル開発ではブラウザからSoundCloudページを直接取得しにくいため、Nodeプロキシを使います。プロキシは `http://127.0.0.1:8787/api/soundcloud/check` で動きます。

## Cloudflare Pages Deploy

Cloudflare PagesのプロジェクトをGitリポジトリから作成し、以下を設定します。

```text
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22.16.0
```

Cloudflare Pages Functionsは `functions/` ディレクトリを自動で検出します。本番環境では同一オリジンの `/api/soundcloud/check` を呼び出します。追加の環境変数は不要です。

ローカルで本番用ビルドを確認する場合:

```sh
npm run build
```

## URL Parameters

ブラウザURLからも取り込めます。

```text
/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack
```

`check=1` を付けると、URL読み込み後に自動で判定を開始します。

```text
/?url=https%3A%2F%2Fon.soundcloud.com%2Fexample&check=1
```

SoundCloudの共有リンクに含まれる `?in=...`、`si=...`、`utm_*` などのクエリ文字列は、判定前にトラック本体URLへ正規化します。

## Architecture

- `src/App.tsx`: URL入力、判定実行、結果表示
- `src/styles.css`: Web UIスタイル
- `src/services/url.ts`: URL正規化とSoundCloudホスト検証
- `src/services/shareIntake.ts`: URL文字列からSoundCloud URLを抽出
- `src/services/soundcloud.ts`: 判定API呼び出し
- `src/services/soundcloudParser.ts`: SoundCloud HTMLメタデータ解析
- `functions/api/soundcloud/check.ts`: Cloudflare Pages Function
- `scripts/soundcloud-metadata-proxy.mjs`: ローカル開発用メタデータプロキシ
- `src/types/soundcloud.ts`: 判定関連の型定義

## Known Risks

- SoundCloud HTML構造は変わる可能性があるため、取得や解析に失敗した場合は `unknown` を返します。
- 外部DLリンク判定と表示は説明欄またはBuy Linkに含まれる既知ホストの検出です。Buy Linkが未知ホストの場合は、ブログや特設サイトなどを経由している可能性があるため `needs_review` を返します。
- SoundCloud側のアクセス制限やHTML構造変更により、Cloudflare Pages Functionからの取得が失敗する可能性があります。
