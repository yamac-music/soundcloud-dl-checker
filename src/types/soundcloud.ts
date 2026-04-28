export type DownloadStatus = "downloadable" | "not_downloadable" | "unknown";

export type RawDownloadFlag =
  | boolean
  | "external_link"
  | "buy_link"
  | "missing"
  | "fetch_failed"
  | "redirect_failed";

export type IntakeSource = "manual" | "share_sheet";

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
  checkedAt: string;
  note: string | null;
}

export interface MetadataSnapshot {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  status: DownloadStatus;
  rawFlag: RawDownloadFlag;
}
