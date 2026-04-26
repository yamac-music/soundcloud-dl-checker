import AsyncStorage from "@react-native-async-storage/async-storage";
import { SoundCloudRecord } from "@/types/history";

const STORAGE_KEY = "soundcloud-dl-checker/history";

export async function loadHistoryRecords() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [] as SoundCloudRecord[];
  }

  try {
    const parsed = JSON.parse(raw) as SoundCloudRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHistoryRecords(records: SoundCloudRecord[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function prependHistoryRecord(record: SoundCloudRecord) {
  const existing = await loadHistoryRecords();
  const nextRecords = [record, ...existing];
  await saveHistoryRecords(nextRecords);
  return nextRecords;
}

