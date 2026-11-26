import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { InviteComposer } from '@/components/invite-composer';
import { Event, formatWhen, listEvents } from '@/lib/events';
import { listFriends } from '@/lib/friends';
import { Invite, listInvites, timeAgo } from '@/lib/invites';

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [e, i, f] = await Promise.all([listEvents(), listInvites(), listFriends()]);
      setEvents(e);
      setInvites(i);
      setFriendCount(f.length);
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
        ListHeaderComponent={
          <View className="gap-3">
            <InviteComposer friendCount={friendCount} />
            {invites.map((inv) => (
              <Link key={inv.id} href={{ pathname: '/invite/[id]', params: { id: inv.id } }} asChild>
                <Pressable className="gap-1 rounded-2xl border border-brand/30 bg-brand/10 p-4 active:opacity-70">
                  <Text className="text-xs font-bold uppercase tracking-wide text-brand">
                    {inv.host_name} · {timeAgo(inv.created_at)}
                  </Text>
                  <Text className="text-lg font-extrabold text-white">{inv.message}</Text>
                </Pressable>
              </Link>
            ))}
            {!!events?.length && (
              <Text className="pt-3 text-xs font-bold uppercase tracking-wide text-white/50">Parties</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center gap-2 pt-16">
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
