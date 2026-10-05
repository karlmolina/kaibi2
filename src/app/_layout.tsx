import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useSession } from '@/lib/auth';

function Routes() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1d1530' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: '#1d1530' },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" options={{ title: 'kaibi' }} />
        <Stack.Screen name="new" options={{ title: 'New event', presentation: 'modal' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
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
