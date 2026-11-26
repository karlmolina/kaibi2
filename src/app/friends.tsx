import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';

import { useSession } from '@/lib/auth';
import {
  Friend,
  friendLink,
  getMyProfile,
  listFriends,
  normalizePhone,
  removeFriend,
  updateMyProfile,
} from '@/lib/friends';
import { notify } from '@/lib/notify';

export default function FriendsScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([getMyProfile(userId), listFriends()]);
      setFriends(f);
      setSavedPhone(p?.phone ?? null);
      setPhone(p?.phone ?? '');
      setOptIn(p?.sms_opt_in ?? false);
    } catch (e) {
      notify('Could not load friends', e instanceof Error ? e.message : 'Try again');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function saveTexts(nextOptIn: boolean) {
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) {
      notify('Check your number', 'Use a 10-digit US number or include your country code, like +44…');
      return;
    }
    if (nextOptIn && !normalized) {
      notify('Add your number first', 'We need a phone number to text you.');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(userId, { phone: normalized, sms_opt_in: nextOptIn && !!normalized });
      setSavedPhone(normalized);
      setPhone(normalized ?? '');
      setOptIn(nextOptIn && !!normalized);
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }

  async function shareLink() {
    const url = friendLink(userId);
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(url);
      notify('Friend link copied', 'Send it to friends. When they open it, you’re connected.');
    } else {
      Share.share({ message: `Add me on kaibi so we can make plans: ${url}` });
    }
  }

  async function unfriend(f: Friend) {
    try {
      await removeFriend(f.id);
      setFriends((list) => list.filter((x) => x.id !== f.id));
    } catch (e) {
      notify('Could not remove friend', e instanceof Error ? e.message : 'Try again');
    }
  }

  const phoneDirty = (normalizePhone(phone) ?? phone.trim()) !== (savedPhone ?? '');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-night">
      <ScrollView contentContainerClassName="w-full max-w-2xl gap-6 self-center p-5" keyboardShouldPersistTaps="handled">
        <View className="gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-white/50">Text alerts</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Your mobile number"
            placeholderTextColor="#ffffff66"
            keyboardType="phone-pad"
            autoComplete="tel"
            className="rounded-xl bg-white/10 px-4 py-3 text-base text-white"
          />
          <Pressable
            disabled={saving}
            onPress={() => saveTexts(phoneDirty ? true : !optIn)}
            className={`items-center rounded-full py-3 ${
              optIn && !phoneDirty ? 'bg-white/10 active:bg-white/20' : 'bg-brand active:bg-brand-dark'
            }`}
          >
            <Text className="font-bold text-white">
              {saving ? 'Saving…' : optIn && !phoneDirty ? 'Texts on · Turn off' : 'Text me when friends ask'}
            </Text>
          </Pressable>
          <Text className="text-xs text-white/50">
            We only text you when a friend asks if anyone’s down, or when someone says yes to yours. Msg &amp; data
            rates may apply. Reply STOP to opt out.
          </Text>
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wide text-white/50">Friends · {friends.length}</Text>
            <Pressable onPress={shareLink} className="rounded-full bg-brand px-4 py-2 active:bg-brand-dark">
              <Text className="font-bold text-white">🔗 Share friend link</Text>
            </Pressable>
          </View>
          {friends.length === 0 && (
            <Text className="text-white/50">Share your friend link. Anyone who opens it becomes your friend.</Text>
          )}
          {friends.map((f) => (
            <View key={f.id} className="flex-row items-center gap-3 rounded-2xl bg-white/10 p-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
                <Text className="font-bold text-white">{f.name.trim().charAt(0).toUpperCase()}</Text>
              </View>
              <Text className="flex-1 font-bold text-white">{f.name}</Text>
              <Pressable onPress={() => unfriend(f)} className="px-2 py-1">
                <Text className="text-sm text-white/50">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
