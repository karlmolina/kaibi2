import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { signOut } from '@/lib/auth';
import { Event, formatWhen, listEvents } from '@/lib/events';

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEvents(await listEvents());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!events && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-night">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row items-center gap-2 pr-4">
              <Pressable
                onPress={() => router.push('/new')}
                className="rounded-full bg-brand px-4 py-2 active:bg-brand-dark"
              >
                <Text className="font-bold text-white">+ Create</Text>
              </Pressable>
              <Pressable onPress={signOut} className="px-3 py-2">
                <Text className="font-bold text-white/70">Sign out</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {error && <Text className="px-5 pt-4 text-red-300">{error}</Text>}
      <FlatList
        data={events ?? []}
        keyExtractor={(e) => e.id}
        contentContainerClassName="w-full max-w-2xl gap-3 self-center p-5"
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}
        ListEmptyComponent={
          <View className="items-center gap-2 pt-24">
            <Text className="text-5xl">🎉</Text>
            <Text className="text-lg font-bold text-white">No parties yet</Text>
            <Text className="text-white/60">Tap + Create to throw the first one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/event/[id]', params: { id: item.id } }} asChild>
            <Pressable className="gap-1 rounded-2xl bg-white/10 p-4 active:opacity-70">
              <Text className="text-xs font-bold uppercase tracking-wide text-brand">
                {formatWhen(item.starts_at)}
              </Text>
              <Text className="text-xl font-extrabold text-white">{item.title}</Text>
              {item.location && <Text className="text-white/60">📍 {item.location}</Text>}
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
