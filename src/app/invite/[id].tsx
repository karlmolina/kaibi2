import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { displayNameOf, useSession } from '@/lib/auth';
import {
  deleteInvite,
  getInvite,
  Invite,
  InviteResponse,
  listResponses,
  respondToInvite,
  timeAgo,
  withdrawResponse,
} from '@/lib/invites';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';

const input = 'rounded-xl bg-white/10 px-4 py-3 text-base text-white';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [invite, setInvite] = useState<Invite | null>(null);
  const [responses, setResponses] = useState<InviteResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [saving, setSaving] = useState(false);

  const mine = responses.find((r) => r.user_id === userId);
  const isHost = !!invite && invite.host_id === userId;

  useEffect(() => {
    Promise.all([getInvite(id), listResponses(id)])
      .then(([i, r]) => {
        setInvite(i);
        setResponses(r);
        const own = r.find((x) => x.user_id === userId);
        if (own) {
          setTime(own.suggested_time ?? '');
          setPlace(own.suggested_place ?? '');
        }
      })
      .catch(() => setError("This invite doesn't exist, or it's only for the host's friends."));

    const channel = supabase
      .channel(`invite_responses:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invite_responses', filter: `invite_id=eq.${id}` },
        () => listResponses(id).then(setResponses),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, userId]);

  async function submit() {
    setSaving(true);
    try {
      await respondToInvite(id, { name: displayNameOf(session), suggested_time: time, suggested_place: place });
      setResponses(await listResponses(id));
    } catch (e) {
      notify('Could not respond', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    try {
      await withdrawResponse(id);
      setResponses(await listResponses(id));
      setTime('');
      setPlace('');
    } catch (e) {
      notify('Could not update', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function remove() {
    try {
      await deleteInvite(id);
      router.replace('/');
    } catch (e) {
      notify('Could not delete', e instanceof Error ? e.message : 'Try again');
    }
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-night p-6">
        <Text className="text-center text-white/70">{error}</Text>
      </View>
    );
  }
  if (!invite) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  const changed = !!mine && ((mine.suggested_time ?? '') !== time.trim() || (mine.suggested_place ?? '') !== place.trim());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-night">
      <ScrollView contentContainerClassName="items-center px-5 pb-16 pt-4" keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-2xl gap-6">
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-brand">
              {isHost ? 'You asked' : `${invite.host_name} asked`} · {timeAgo(invite.created_at)}
            </Text>
            <Text className="text-4xl font-extrabold text-white">{invite.message}</Text>
          </View>

          {!isHost && (
            <View className="gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-white/50">
                {mine ? "You're in" : 'Down?'}
              </Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="Suggest a time (optional), e.g. 9pm"
                placeholderTextColor="#ffffff66"
                maxLength={60}
                className={input}
              />
              <TextInput
                value={place}
                onChangeText={setPlace}
                placeholder="Suggest a place (optional)"
                placeholderTextColor="#ffffff66"
                maxLength={120}
                className={input}
              />
              {!mine ? (
                <Pressable
                  disabled={saving}
                  onPress={submit}
                  className="items-center rounded-full bg-brand py-3.5 active:bg-brand-dark"
                >
                  <Text className="text-lg font-extrabold text-white">{saving ? 'Sending…' : "🙋 I'm interested"}</Text>
                </Pressable>
              ) : (
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={!changed || saving}
                    onPress={submit}
                    className={`flex-1 items-center rounded-full py-3 ${changed ? 'bg-brand active:bg-brand-dark' : 'bg-white/10'}`}
                  >
                    <Text className="font-bold text-white">{saving ? 'Saving…' : 'Update suggestion'}</Text>
                  </Pressable>
                  <Pressable onPress={withdraw} className="flex-1 items-center rounded-full bg-white/10 py-3 active:bg-white/20">
                    <Text className="font-bold text-white/80">Not anymore</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-wide text-white/50">
              🙋 Interested · {responses.length}
            </Text>
            {responses.length === 0 && (
              <Text className="text-white/50">{isHost ? 'Waiting on your friends…' : 'Nobody yet. Be the first!'}</Text>
            )}
            {responses.map((r) => (
              <View key={r.user_id} className="flex-row items-start gap-3 rounded-2xl bg-white/10 p-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
                  <Text className="font-bold text-white">{r.name.trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-bold text-white">{r.user_id === userId ? `${r.name} (you)` : r.name}</Text>
                  {r.suggested_time && <Text className="text-white/70">🕘 {r.suggested_time}</Text>}
                  {r.suggested_place && <Text className="text-white/70">📍 {r.suggested_place}</Text>}
                </View>
              </View>
            ))}
          </View>

          {isHost && (
            <Pressable onPress={remove} className="items-center py-3">
              <Text className="font-bold text-red-300">Delete invite</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
