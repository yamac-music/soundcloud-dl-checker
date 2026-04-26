import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { RecordCard } from "@/components/RecordCard";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { useHistory } from "@/hooks/useHistory";

export function HistoryScreen() {
  const router = useRouter();
  const { loading, records } = useHistory();

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Newest checks first. Tap a row to inspect the stored record.</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={records.length ? styles.listContent : styles.emptyContainer}
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecordCard onPress={() => router.push(`/record/${item.id}`)} record={item} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No saved checks yet. Run a URL check from the home screen first.</Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  header: {
    gap: 8,
    marginBottom: 18
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  listContent: {
    paddingBottom: 24
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center"
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  separator: {
    height: 12
  }
});

