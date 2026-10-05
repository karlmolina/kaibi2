import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signOut } from '@/lib/auth';

export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }} className="bg-[#1d1530]">
      <View className="h-12 flex-row items-center justify-between px-2 md:h-16 md:px-6">
        <Pressable onPress={() => router.dismissTo('/')} className="px-3 py-2">
          <Text className="text-lg font-extrabold text-white">kaibi</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
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
      </View>
    </View>
  );
}
