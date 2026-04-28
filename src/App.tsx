import { useEffect, useRef, useState } from "react";
import { buildIntakeRequest, extractSoundCloudUrl } from "@/services/shareIntake";
import { checkSoundCloudUrl } from "@/services/soundcloud";
import type { DownloadLink, DownloadStatus, IntakeSource, MetadataSnapshot, SoundCloudCheck } from "@/types/soundcloud";

export function App() {
  const handledInitialUrl = useRef<string | null>(null);
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SoundCloudCheck | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingUrl = params.get("url") ?? undefined;
    const normalizedUrl = extractSoundCloudUrl(incomingUrl);

    if (!normalizedUrl || handledInitialUrl.current === normalizedUrl) {
      return;
    }

    handledInitialUrl.current = normalizedUrl;
    setUrl(normalizedUrl);

    if (shouldAutoCheck(params.get("check") ?? undefined)) {
      void runCheck(normalizedUrl);
    }
  }, []);

  async function runCheck(value: string, source: IntakeSource = "manual") {
    setChecking(true);
    setError(null);

    try {
      const intake = buildIntakeRequest(value, source);
      const check = await checkSoundCloudUrl(intake.url);
      const nextResult = buildResult(intake.source, intake.url, check.resolvedUrl, check.metadata);
      setUrl(nextResult.sourceUrl);
      setResult(nextResult);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "判定に失敗しました。";
      setError(message);
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="checker" aria-labelledby="app-title">
        <header className="hero">
          <h1 id="app-title">SoundCloud DL Checker</h1>
          <p>SoundCloudのトラックがDL可能かを判定</p>
        </header>

        <form
          className="check-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runCheck(url);
          }}
        >
          <label className="field-label" htmlFor="soundcloud-url">
            URLを貼り付け
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              ↗
            </span>
            <input
              autoCapitalize="none"
              autoComplete="url"
              autoCorrect="off"
              id="soundcloud-url"
              inputMode="url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://soundcloud.com/artist/track-title"
              type="url"
              value={url}
            />
            <button
              aria-label="URLをクリア"
              className="clear-button"
              onClick={() => {
                setUrl("");
                setError(null);
                setResult(null);
              }}
              type="button"
            >
              ×
            </button>
          </div>

          <button className="primary-button" disabled={checking} type="submit">
            {checking ? <span className="spinner" aria-hidden="true" /> : <span className="search-icon">⌕</span>}
            <span>{checking ? "判定中" : "判定する"}</span>
          </button>
        </form>

        <p className="safe-note">
          <span aria-hidden="true">♢</span>
          公開トラックの情報だけを確認します
        </p>

        {error ? <p className="error-message">{error}</p> : null}

        <section className="result-card" aria-labelledby="result-title">
          <h2 id="result-title">判定結果</h2>
          {result ? <ResultContent record={result} /> : <p className="empty-text">URLを判定すると、ダウンロード可否だけをここに表示します。</p>}
        </section>
      </section>
    </main>
  );
}

function buildResult(
  source: IntakeSource,
  sourceUrl: string,
  resolvedUrl: string,
  metadata: MetadataSnapshot
): SoundCloudCheck {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    sourceUrl,
    resolvedUrl,
    title: metadata.title,
    artist: metadata.artist,
    artworkUrl: metadata.artworkUrl,
    status: metadata.status,
    rawFlag: metadata.rawFlag,
    downloadLinks: metadata.downloadLinks ?? [],
    checkedAt: new Date().toISOString(),
    note: null
  };
}

function ResultContent({ record }: { record: SoundCloudCheck }) {
  return (
    <>
      <div className="result-content">
        <Artwork uri={record.artworkUrl} />
        <div className="result-body">
          <p className="track-title">{record.title || "タイトル未取得"}</p>
          <p className="artist-name">{record.artist || "アーティスト未取得"}</p>
          <p className="url-line">
            <span aria-hidden="true">↗</span>
            <span>{shortenUrl(record.resolvedUrl)}</span>
          </p>
        </div>
      </div>
      <LargeStatus status={record.status} />
      {record.downloadLinks.length ? <DownloadLinks links={record.downloadLinks} /> : null}
      <div className="card-divider" />
      <dl className="meta-rows">
        <MetaRow label="判定日時" value={formatLatestDate(record.checkedAt)} />
        <MetaRow label="判定根拠" value={formatRawFlag(record.rawFlag)} />
      </dl>
    </>
  );
}

function DownloadLinks({ links }: { links: DownloadLink[] }) {
  return (
    <div className="download-links" aria-label="抽出したDLリンク">
      <p className="download-links-title">抽出したDLリンク</p>
      <div className="download-link-list">
        {links.map((link) => (
          <a className="download-link-button" href={link.url} key={link.url} rel="noreferrer" target="_blank">
            <span>{formatDownloadLinkSource(link.source)}</span>
            <strong>{shortenUrl(link.url)}</strong>
            <em>開く ↗</em>
          </a>
        ))}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Artwork({ uri }: { uri: string | null }) {
  if (uri) {
    return <img alt="" className="artwork" src={uri} />;
  }

  return (
    <div className="artwork artwork-placeholder" aria-hidden="true">
      <span className="cloud cloud-a" />
      <span className="cloud cloud-b" />
    </div>
  );
}

function LargeStatus({ status }: { status: DownloadStatus }) {
  const isOk = status === "downloadable";
  const isUnknown = status === "unknown";
  const label = isOk ? "ダウンロード可能" : isUnknown ? "判定できません" : "ダウンロード不可";
  const icon = isOk ? "✓" : isUnknown ? "?" : "×";

  return (
    <div className={`large-status status-${status}`}>
      <span className="status-circle">{icon}</span>
      <strong>{label}</strong>
    </div>
  );
}

function shouldAutoCheck(value?: string) {
  const normalized = value?.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function shortenUrl(value: string) {
  return value.replace(/^https?:\/\//, "");
}

function formatLatestDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDownloadLinkSource(value: DownloadLink["source"]) {
  return value === "buy_link" ? "Buy Link" : "説明欄";
}

function formatRawFlag(value: SoundCloudCheck["rawFlag"]) {
  if (value === true) {
    return "SoundCloudのdownloadable=true";
  }

  if (value === "external_link") {
    return "説明欄の外部DLリンク";
  }

  if (value === "buy_link") {
    return "Buy Linkの外部DLリンク";
  }

  if (value === false) {
    return "SoundCloudのdownloadable=false";
  }

  if (value === "missing") {
    return "公開メタデータなし";
  }

  if (value === "fetch_failed") {
    return "取得失敗";
  }

  if (value === "redirect_failed") {
    return "短縮URLの解決失敗";
  }

  return "不明";
}
