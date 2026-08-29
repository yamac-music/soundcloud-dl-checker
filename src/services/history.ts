import { normalizeUrlCandidate } from "@/services/url";
import type { DownloadLink, DownloadStatus, HistoryEntry, RawDownloadFlag, SoundCloudCheck } from "@/types/soundcloud";

export const HISTORY_STORAGE_KEY = "soundcloud-dl-checker:history:v1";
export const HISTORY_LIMIT = 100;

const DOWNLOAD_STATUSES = new Set<DownloadStatus>([
  "downloadable",
  "not_downloadable",
  "needs_review",
  "unknown"
]);
const RAW_FLAGS = new Set<RawDownloadFlag>([
  true,
  false,
  "external_link",
  "buy_link",
  "buy_link_unverified",
  "missing",
  "fetch_failed",
  "redirect_failed"
]);

export function createHistoryEntry(record: SoundCloudCheck): HistoryEntry {
  return {
    resolvedUrl: normalizeHistoryUrl(record.resolvedUrl),
    title: record.title,
    artist: record.artist,
    artworkUrl: safeHttpUrl(record.artworkUrl),
    status: record.status,
    rawFlag: record.rawFlag,
    downloadLinks: record.downloadLinks.filter(isDownloadLink),
    checkedAt: record.checkedAt
  };
}

export function loadHistory(storage = getLocalStorage()): HistoryEntry[] {
  if (!storage) {
    return [];
  }

  try {
    const value = storage.getItem(HISTORY_STORAGE_KEY);
    if (!value) {
      return [];
    }

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isHistoryEntry)
      .map(normalizeHistoryEntry)
      .sort((left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt))
      .reduce(upsertHistory, [] as HistoryEntry[]);
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[], storage = getLocalStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function clearHistory(storage = getLocalStorage()) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function upsertHistory(entries: HistoryEntry[], nextEntry: HistoryEntry) {
  const key = normalizeHistoryUrl(nextEntry.resolvedUrl);
  const withoutCurrent = entries.filter((entry) => normalizeHistoryUrl(entry.resolvedUrl) !== key);

  return [nextEntry, ...withoutCurrent]
    .sort((left, right) => Date.parse(right.checkedAt) - Date.parse(left.checkedAt))
    .slice(0, HISTORY_LIMIT);
}

export function removeHistoryEntry(entries: HistoryEntry[], resolvedUrl: string) {
  const key = normalizeHistoryUrl(resolvedUrl);
  return entries.filter((entry) => normalizeHistoryUrl(entry.resolvedUrl) !== key);
}

export function normalizeHistoryUrl(value: string) {
  const normalized = new URL(normalizeUrlCandidate(value));
  normalized.protocol = "https:";
  normalized.pathname = normalized.pathname.replace(/\/+$/, "") || "/";
  return normalized.toString();
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;

  try {
    normalizeHistoryUrl(String(entry.resolvedUrl));
  } catch {
    return false;
  }

  return (
    isNullableString(entry.title) &&
    isNullableString(entry.artist) &&
    (entry.artworkUrl === null || safeHttpUrl(entry.artworkUrl) !== null) &&
    DOWNLOAD_STATUSES.has(entry.status as DownloadStatus) &&
    RAW_FLAGS.has(entry.rawFlag as RawDownloadFlag) &&
    Array.isArray(entry.downloadLinks) &&
    entry.downloadLinks.every(isDownloadLink) &&
    typeof entry.checkedAt === "string" &&
    Number.isFinite(Date.parse(entry.checkedAt))
  );
}

function isDownloadLink(value: unknown): value is DownloadLink {
  if (!value || typeof value !== "object") {
    return false;
  }

  const link = value as Record<string, unknown>;
  return (
    (link.kind === "download" || link.kind === "unverified_buy_link") &&
    (link.source === "description" || link.source === "buy_link") &&
    typeof link.url === "string" &&
    safeHttpUrl(link.url) !== null
  );
}

function normalizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    resolvedUrl: normalizeHistoryUrl(entry.resolvedUrl),
    artworkUrl: safeHttpUrl(entry.artworkUrl),
    downloadLinks: entry.downloadLinks.map((link) => ({
      ...link,
      url: safeHttpUrl(link.url) as string
    }))
  };
}

function safeHttpUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function getLocalStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
