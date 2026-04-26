import { useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/theme";
import { useHistory } from "@/hooks/useHistory";

export function HomeScreen() {
  const [url, setUrl] = useState("");
  const { checking, error, lastRecord, runCheck } = useHistory();

  async function handleRunCheck() {
    const record = await runCheck(url);

    if (record) {
      setUrl(record.sourceUrl);
    }
  }

  return (
    <Screen scrollable>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SoundCloud public-page checker</Text>
        <Text style={styles.title}>Check download availability without touching audio files.</Text>
        <Text style={styles.description}>
          Paste a SoundCloud track URL, resolve short links, classify the public download flag, and
          keep a local record.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>SoundCloud URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setUrl}
          placeholder="https://soundcloud.com/artist/track"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={url}
        />
        <Pressable disabled={checking} onPress={handleRunCheck} style={styles.button}>
          {checking ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Check availability</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest result</Text>
          <Link href="/history" style={styles.link}>
            Open history
          </Link>
        </View>

        {lastRecord ? (
          <View style={styles.resultCard}>
            <StatusBadge status={lastRecord.status} />
            <Text style={styles.resultTitle}>{lastRecord.title || "Untitled SoundCloud track"}</Text>
            <Text style={styles.resultMeta}>{lastRecord.artist || lastRecord.resolvedUrl}</Text>
            <Text style={styles.resultMeta}>Resolved URL: {lastRecord.resolvedUrl}</Text>
            <Text style={styles.resultMeta}>Raw flag: {String(lastRecord.rawFlag)}</Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No checks yet. The first completed check will appear here.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 12,
    marginBottom: 24
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    marginBottom: 18
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.background,
    color: colors.text
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700"
  },
  error: {
    color: colors.danger,
    fontSize: 13
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  resultCard: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  resultTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  }
});

