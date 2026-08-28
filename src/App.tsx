import { useEffect, useRef, useState } from "react";
import { buildIntakeRequest, extractSoundCloudUrl } from "@/services/shareIntake";
import { checkSoundCloudUrl } from "@/services/soundcloud";
import {
  clearHistory,
  createHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  saveHistory,
  upsertHistory
} from "@/services/history";
import type {
  DownloadLink,
  DownloadStatus,
  HistoryEntry,
  IntakeSource,
  MetadataSnapshot,
  SoundCloudCheck
} from "@/types/soundcloud";

const SUPPORT_URL = "https://buymeacoffee.com/yamac";

export function App() {
  const handledInitialUrl = useRef<string | null>(null);
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SoundCloudCheck | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const historyRef = useRef(history);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);

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
      updateHistory(upsertHistory(historyRef.current, createHistoryEntry(nextResult)));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "判定に失敗しました。";
      setError(message);
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  function updateHistory(nextHistory: HistoryEntry[]) {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setHistoryMessage(
      saveHistory(nextHistory) ? null : "判定履歴をこのブラウザに保存できませんでした。判定機能は引き続き利用できます。"
    );
  }

  function deleteHistoryEntry(resolvedUrl: string) {
    updateHistory(removeHistoryEntry(historyRef.current, resolvedUrl));
  }

  function deleteAllHistory() {
    if (!window.confirm("判定履歴をすべて削除しますか？")) {
      return;
    }

    historyRef.current = [];
    setHistory([]);
    setHistoryMessage(
      clearHistory() ? null : "判定履歴をこのブラウザから削除できませんでした。"
    );
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

        <HistorySection
          entries={history}
          message={historyMessage}
          onClear={deleteAllHistory}
          onRemove={deleteHistoryEntry}
        />

        <SupportLink />
      </section>
    </main>
  );
}

function HistorySection({
  entries,
  message,
  onClear,
  onRemove
}: {
  entries: HistoryEntry[];
  message: string | null;
  onClear: () => void;
  onRemove: (resolvedUrl: string) => void;
}) {
  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="history-heading">
        <h2 id="history-title">判定履歴{entries.length ? `（${entries.length}件）` : ""}</h2>
        {entries.length ? (
          <button className="clear-history-button" onClick={onClear} type="button">
            全削除
          </button>
        ) : null}
      </div>
      <p className="history-note">判定履歴はこのブラウザに保存されます。</p>
      {message ? (
        <p className="history-message" role="status">
          {message}
        </p>
      ) : null}
      {entries.length ? (
        <ul className="history-list">
          {entries.map((entry) => (
            <li className="history-item" key={entry.resolvedUrl}>
              <div className="history-track">
                <HistoryArtwork entry={entry} />
                <div className="history-track-body">
                  <a className="history-track-link" href={entry.resolvedUrl} rel="noreferrer" target="_blank">
                    {entry.title || "タイトル未取得"}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                  <p>{entry.artist || "アーティスト未取得"}</p>
                </div>
                <button
                  aria-label={`${entry.title || "この曲"}の履歴を削除`}
                  className="delete-history-button"
                  onClick={() => onRemove(entry.resolvedUrl)}
                  type="button"
                >
                  削除
                </button>
              </div>
              <div className="history-summary">
                <StatusBadge status={entry.status} />
                <time dateTime={entry.checkedAt}>{formatLatestDate(entry.checkedAt)}</time>
              </div>
              {entry.downloadLinks.length ? <HistoryDownloadLinks links={entry.downloadLinks} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">判定履歴はまだありません。</p>
      )}
    </section>
  );
}

function HistoryArtwork({ entry }: { entry: HistoryEntry }) {
  if (entry.artworkUrl) {
    return <img alt="" className="history-artwork" loading="lazy" src={entry.artworkUrl} />;
  }

  return <div className="history-artwork history-artwork-placeholder" aria-hidden="true">♪</div>;
}

function StatusBadge({ status }: { status: DownloadStatus }) {
  const labels: Record<DownloadStatus, string> = {
    downloadable: "✓ DL可能",
    not_downloadable: "× DL不可",
    needs_review: "⚠ 要確認",
    unknown: "? 判定不能"
  };

  return <span className={`history-status status-${status}`}>{labels[status]}</span>;
}

function HistoryDownloadLinks({ links }: { links: DownloadLink[] }) {
  return (
    <div className="history-download-links" aria-label="検出済みの外部ダウンロードリンク">
      {links.map((link) => (
        <a href={link.url} key={`${link.source}-${link.url}`} rel="noreferrer" target="_blank">
          {formatDownloadLinkSource(link.source, link.kind)}を開く
          <span aria-hidden="true"> ↗</span>
        </a>
      ))}
    </div>
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
    <div className="download-links" aria-label="抽出したリンク">
      <p className="download-links-title">抽出したリンク</p>
      <div className="download-link-list">
        {links.map((link) => (
          <a
            className={`download-link-button link-${link.kind}`}
            href={link.url}
            key={link.url}
            rel="noreferrer"
            target="_blank"
          >
            <span>{formatDownloadLinkSource(link.source, link.kind)}</span>
            <strong>{shortenUrl(link.url)}</strong>
            <em>開く ↗</em>
          </a>
        ))}
      </div>
    </div>
  );
}

function SupportLink() {
  return (
    <aside className="support-box" aria-label="開発支援">
      <p>役に立ったら、開発と運営を支援できます。</p>
      <a className="support-button" href={SUPPORT_URL}>
        <span aria-hidden="true">☕</span>
        <span>Buy me a coffee</span>
      </a>
    </aside>
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
  const needsReview = status === "needs_review";
  const isUnknown = status === "unknown";
  const label = isOk ? "ダウンロード可能" : needsReview ? "要確認" : isUnknown ? "判定できません" : "ダウンロード不可";
  const icon = isOk ? "✓" : needsReview ? "⚠" : isUnknown ? "?" : "×";

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

function formatDownloadLinkSource(value: DownloadLink["source"], kind?: DownloadLink["kind"]) {
  if (value === "buy_link" && kind === "unverified_buy_link") {
    return "Buy Link / 要確認";
  }

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

  if (value === "buy_link_unverified") {
    return "Buy Linkが外部サイトのため要確認";
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
