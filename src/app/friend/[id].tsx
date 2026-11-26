import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useSession } from '@/lib/auth';
import { addFriend, getProfileName } from '@/lib/friends';
import { notify } from '@/lib/notify';

/** Opened from someone's friend link: confirm, then connect both ways. */
export default function AddFriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProfileName(id)
      .then(setName)
      .catch(() => setName(null));
  }, [id]);

  async function accept() {
    setBusy(true);
    try {
      await addFriend(id);
      router.replace('/friends');
    } catch (e) {
      notify('Could not add friend', e instanceof Error ? e.message : 'Try again');
      setBusy(false);
    }
  }

  if (name === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-night">
        <ActivityIndicator color="#ff4d8d" />
      </View>
    );
  }

  const isMe = id === session?.user.id;

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-night p-8">
      <Text className="text-6xl">🤝</Text>
      {!name ? (
        <Text className="text-center text-white/70">This friend link isn’t valid.</Text>
      ) : isMe ? (
        <Text className="text-center text-white/70">This is your own friend link. Send it to your friends!</Text>
      ) : (
        <>
          <Text className="text-center text-3xl font-extrabold text-white">Add {name} as a friend?</Text>
          <Text className="text-center text-white/60">
            You’ll each see the other’s “anyone down?” posts and get a text when they ask.
          </Text>
          <Pressable
            disabled={busy}
            onPress={accept}
            className="w-full max-w-sm items-center rounded-full bg-brand py-4 active:bg-brand-dark"
          >
            <Text className="text-lg font-extrabold text-white">{busy ? 'Adding…' : 'Add friend'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
