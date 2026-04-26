import { Pressable, StyleSheet, Text, View } from "react-native";
import { SoundCloudRecord } from "@/types/history";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/theme";

interface RecordCardProps {
  record: SoundCloudRecord;
  onPress: () => void;
}

export function RecordCard({ record, onPress }: RecordCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <StatusBadge status={record.status} />
        <Text style={styles.date}>{new Date(record.checkedAt).toLocaleString()}</Text>
      </View>
      <Text style={styles.title}>{record.title || "Untitled SoundCloud track"}</Text>
      <Text style={styles.subtitle}>{record.artist || record.resolvedUrl}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  date: {
    color: colors.textMuted,
    fontSize: 12
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13
  }
});

