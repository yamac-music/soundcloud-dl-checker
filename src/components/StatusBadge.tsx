import { StyleSheet, Text, View } from "react-native";
import { statusColors } from "@/constants/theme";
import { DownloadStatus } from "@/types/history";

interface StatusBadgeProps {
  status: DownloadStatus;
}

const labels: Record<DownloadStatus, string> = {
  downloadable: "Downloadable",
  not_downloadable: "Not downloadable",
  unknown: "Unknown"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: statusColors[status].background }]}>
      <Text style={[styles.label, { color: statusColors[status].text }]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  label: {
    fontSize: 12,
    fontWeight: "700"
  }
});

