import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HistoryProvider } from "@/context/HistoryContext";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <HistoryProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="index" options={{ title: "Checker" }} />
        <Stack.Screen name="history" options={{ title: "History" }} />
        <Stack.Screen name="record/[id]" options={{ title: "Record" }} />
      </Stack>
    </HistoryProvider>
  );
}

