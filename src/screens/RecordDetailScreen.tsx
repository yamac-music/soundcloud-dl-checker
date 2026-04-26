import { useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/theme";
import { useHistory } from "@/hooks/useHistory";

export function RecordDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { getRecordById } = useHistory();
  const record = getRecordById(params.id);

  if (!record) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.emptyTitle}>Record not found</Text>
        <Text style={styles.emptyText}>
          The requested history item is not currently loaded. Return to history and try again.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <StatusBadge status={record.status} />
        <Text style={styles.title}>{record.title || "Untitled SoundCloud track"}</Text>
        <Text style={styles.subtitle}>{record.artist || "Unknown artist"}</Text>
      </View>

      <View style={styles.panel}>
        <DetailRow label="Checked at" value={new Date(record.checkedAt).toLocaleString()} />
        <DetailRow label="Source URL" value={record.sourceUrl} />
        <DetailRow label="Resolved URL" value={record.resolvedUrl} />
        <DetailRow label="Raw flag" value={String(record.rawFlag)} />
        <DetailRow label="Note" value={record.note || "No note stored yet."} />
      </View>

      <Pressable onPress={() => Linking.openURL(record.resolvedUrl)} style={styles.button}>
        <Text style={styles.buttonText}>Open original track page</Text>
      </Pressable>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  header: {
    marginBottom: 18,
    gap: 10
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 16,
    marginBottom: 16
  },
  row: {
    gap: 6
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700"
  }
});
