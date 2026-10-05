import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { signInWithGoogle } from '@/lib/auth';
import { notify } from '@/lib/notify';

export default function SignInScreen() {
  const [busy, setBusy] = useState(false);

  async function onPress() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      notify('Sign-in failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-10 bg-night p-8">
      <View className="items-center gap-2">
        <Text className="text-6xl">🎉</Text>
        <Text className="text-5xl font-extrabold text-white">kaibi</Text>
        <Text className="text-base text-white/60">Throw parties. Get RSVPs.</Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={busy}
        className="w-full flex-row items-center justify-center gap-3 rounded-full bg-white py-4 active:opacity-80"
      >
        {busy ? <ActivityIndicator color="#17121f" /> : <Text className="text-lg font-extrabold text-ink">Continue with Google</Text>}
      </Pressable>
    </View>
  );
}
