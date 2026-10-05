import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Platform, ScrollView, Share, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

import { Event, formatWhen, getEvent, listRsvps, Rsvp, RsvpStatus, setRsvp } from '@/lib/events';
import { displayNameOf, useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

const OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: 'going', label: "🎉 Going" },
  { status: 'maybe', label: '🤔 Maybe' },
  { status: 'cant', label: "😢 Can't" },
];

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const displayName = displayNameOf(session);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEvent(id), listRsvps(id)])
      .then(([e, r]) => {
        setEvent(e);
        setRsvps(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load event'));

    const channel = supabase
      .channel(`rsvps:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${id}` }, () =>
        listRsvps(id).then(setRsvps),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const mine = rsvps.find((r) => r.user_id === userId);

  async function respond(status: RsvpStatus) {
    try {
      await setRsvp(id, displayName, status);
      setRsvps(await listRsvps(id));
    } catch (e) {
      notify('Could not RSVP', e instanceof Error ? e.message : 'Try again');
    }
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-night p-6">
        <Text className="text-white/70">{error}</Text>
      </View>
    );
  }
  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  const group = (s: RsvpStatus) => rsvps.filter((r) => r.status === s);

  return (
    <ScrollView className="flex-1 bg-night" contentContainerClassName="gap-6 p-5 pb-16">
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={async () => {
                const url = Linking.createURL(`/event/${event.id}`);
                if (Platform.OS === 'web') {
                  await navigator.clipboard.writeText(url);
                  notify('Link copied', url);
                } else {
                  Share.share({ message: `${event.title} — ${url}` });
                }
              }}
            >
              <Text className="font-bold text-brand">Share</Text>
            </Pressable>
          ),
        }}
      />
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wide text-brand">{formatWhen(event.starts_at)}</Text>
        <Text className="text-4xl font-extrabold text-white">{event.title}</Text>
        {event.location && <Text className="text-base text-white/70">📍 {event.location}</Text>}
        {userId === event.host_id && <Text className="text-xs font-bold text-white/40">You&apos;re hosting</Text>}
      </View>

      {event.description && <Text className="text-base leading-6 text-white/80">{event.description}</Text>}

      <View className="gap-3 rounded-2xl bg-white/10 p-4">
        <View className="flex-row gap-2">
          {OPTIONS.map((o) => (
            <Pressable
              key={o.status}
              onPress={() => respond(o.status)}
              className={`flex-1 items-center rounded-full py-3 ${
                mine?.status === o.status ? 'bg-brand' : 'bg-white/10 active:bg-white/20'
              }`}
            >
              <Text className="font-bold text-white">{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {OPTIONS.map((o) => {
        const people = group(o.status);
        if (!people.length) return null;
        return (
          <View key={o.status} className="gap-2">
            <Text className="text-xs font-bold uppercase text-white/50">
              {o.label} · {people.length}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {people.map((p) => (
                <Text key={p.user_id} className="rounded-full bg-white/10 px-3 py-1.5 text-white">
                  {p.name}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
