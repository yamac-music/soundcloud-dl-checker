import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import {
  MetadataSnapshot,
  SoundCloudRecord
} from "@/types/history";
import { prependHistoryRecord, loadHistoryRecords } from "@/storage/historyStorage";
import { buildIntakeRequest } from "@/services/shareIntake";
import { fetchSoundCloudMetadata, resolveSoundCloudUrl } from "@/services/soundcloud";

interface HistoryContextValue {
  records: SoundCloudRecord[];
  lastRecord: SoundCloudRecord | null;
  loading: boolean;
  checking: boolean;
  error: string | null;
  runCheck: (url: string) => Promise<SoundCloudRecord | null>;
  getRecordById: (id: string) => SoundCloudRecord | undefined;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

function buildRecord(
  sourceUrl: string,
  resolvedUrl: string,
  metadata: MetadataSnapshot
): SoundCloudRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceUrl,
    resolvedUrl,
    title: metadata.title,
    artist: metadata.artist,
    artworkUrl: metadata.artworkUrl,
    status: metadata.status,
    rawFlag: metadata.rawFlag,
    checkedAt: new Date().toISOString(),
    note: null
  };
}

export function HistoryProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<SoundCloudRecord[]>([]);
  const [lastRecord, setLastRecord] = useState<SoundCloudRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadHistoryRecords()
      .then((stored) => {
        if (!active) {
          return;
        }

        setRecords(stored);
        setLastRecord(stored[0] ?? null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function runCheck(url: string) {
    setChecking(true);
    setError(null);

    try {
      const intake = buildIntakeRequest(url, "manual");
      const resolvedUrl = await resolveSoundCloudUrl(intake.url);
      const metadata = await fetchSoundCloudMetadata(resolvedUrl);
      const record = buildRecord(intake.url, resolvedUrl, metadata);
      const nextRecords = await prependHistoryRecord(record);
      setRecords(nextRecords);
      setLastRecord(record);
      return record;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Check failed.";
      setError(message);
      return null;
    } finally {
      setChecking(false);
    }
  }

  function getRecordById(id: string) {
    return records.find((record) => record.id === id);
  }

  return (
    <HistoryContext.Provider
      value={{
        records,
        lastRecord,
        loading,
        checking,
        error,
        runCheck,
        getRecordById
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryContext() {
  const context = useContext(HistoryContext);

  if (!context) {
    throw new Error("useHistoryContext must be used inside HistoryProvider.");
  }

  return context;
}

