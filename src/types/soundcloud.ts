export type DownloadStatus = "downloadable" | "not_downloadable" | "needs_review" | "unknown";

export type RawDownloadFlag =
  | boolean
  | "external_link"
  | "buy_link"
  | "buy_link_unverified"
  | "missing"
  | "fetch_failed"
  | "redirect_failed";

export type IntakeSource = "manual" | "share_sheet";

export type DownloadLinkSource = "description" | "buy_link";
export type DownloadLinkKind = "download" | "unverified_buy_link";

export interface DownloadLink {
  kind: DownloadLinkKind;
  source: DownloadLinkSource;
  url: string;
}

export interface IntakeRequest {
  source: IntakeSource;
  url: string;
}

export interface SoundCloudCheck {
  id: string;
  source: IntakeSource;
  sourceUrl: string;
  resolvedUrl: string;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  status: DownloadStatus;
  rawFlag: RawDownloadFlag;
  downloadLinks: DownloadLink[];
  checkedAt: string;
  note: string | null;
}

export interface HistoryEntry {
  resolvedUrl: string;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  status: DownloadStatus;
  rawFlag: RawDownloadFlag;
  downloadLinks: DownloadLink[];
  checkedAt: string;
}

export interface MetadataSnapshot {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  status: DownloadStatus;
  rawFlag: RawDownloadFlag;
  downloadLinks: DownloadLink[];
}
