import { useLocalSearchParams } from 'expo-router';
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

  async function share() {
    if (!event) return;
    const url = Linking.createURL(`/event/${event.id}`);
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(url);
      notify('Link copied', url);
    } else {
      Share.share({ message: `${event.title} — ${url}` });
    }
  }

  const group = (s: RsvpStatus) => rsvps.filter((r) => r.status === s);

  return (
    <ScrollView className="flex-1 bg-night" contentContainerClassName="items-center px-5 pb-16 pt-4">
      <View className="w-full max-w-2xl gap-6">
        <View className="flex-row items-start gap-4">
          <View className="flex-1 gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-brand">{formatWhen(event.starts_at)}</Text>
            <Text className="text-4xl font-extrabold text-white">{event.title}</Text>
            {event.location && <Text className="text-base text-white/70">📍 {event.location}</Text>}
            {userId === event.host_id && (
              <Text className="self-start rounded-full bg-brand/20 px-2.5 py-1 text-xs font-bold text-brand">
                You&apos;re hosting
              </Text>
            )}
          </View>
          <Pressable
            onPress={share}
            accessibilityLabel="Share event"
            className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 active:opacity-70"
          >
            <Text className="text-lg">🔗</Text>
          </Pressable>
        </View>

        {event.description && <Text className="text-base leading-6 text-white/80">{event.description}</Text>}

        <View className="gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-white/50">Your RSVP</Text>
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

        {rsvps.length === 0 && <Text className="text-center text-white/50">No RSVPs yet. Be the first!</Text>}

        {OPTIONS.map((o) => {
          const people = group(o.status);
          if (!people.length) return null;
          return (
            <View key={o.status} className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-white/50">
                {o.label} · {people.length}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {people.map((p) => (
                  <View key={p.user_id} className="flex-row items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3.5">
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
                      <Text className="text-xs font-bold text-white">{p.name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text className="text-white">{p.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
