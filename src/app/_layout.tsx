import "@/global.css";

import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { TopBar } from "@/components/top-bar";
import { AuthProvider, useSession } from "@/lib/auth";

function Routes() {
  const { session, loading } = useSession();
  const segments = useSegments();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  // Rendered here rather than as a per-screen header so it also shows when a screen is opened directly from a link.
  const showTopBar =
    !!session && segments[0] !== "sign-in" && segments[0] !== "auth";

  return (
    <View className="flex-1 bg-night">
      {showTopBar && <TopBar />}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#1d1530" },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="new" />
          <Stack.Screen name="event/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Routes />
    </AuthProvider>
  );
}
