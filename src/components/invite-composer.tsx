import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { displayNameOf, useSession } from '@/lib/auth';
import { createInvite } from '@/lib/invites';
import { notify } from '@/lib/notify';

type Props = { friendCount: number | null };

export function InviteComposer({ friendCount }: Props) {
  const router = useRouter();
  const { session } = useSession();
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const canPost = message.trim().length > 0 && !posting;

  async function post() {
    setPosting(true);
    try {
      const invite = await createInvite(displayNameOf(session), message);
      setMessage('');
      router.push({ pathname: '/invite/[id]', params: { id: invite.id } });
    } catch (e) {
      notify('Could not post', e instanceof Error ? e.message : 'Try again');
    } finally {
      setPosting(false);
    }
  }

  return (
    <View className="gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Anyone down for pool tonight?"
        placeholderTextColor="#ffffff66"
        maxLength={200}
        multiline
        className="min-h-12 text-lg font-bold text-white"
        textAlignVertical="top"
      />
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-xs text-white/50">
          {friendCount === 0 ? (
            <>
              No friends yet.{' '}
              <Link href="/friends" className="font-bold text-brand">
                Add some
              </Link>{' '}
              so they get a text.
            </>
          ) : (
            'Your friends get a text and can say they’re in.'
          )}
        </Text>
        <Pressable
          disabled={!canPost}
          onPress={post}
          className={`rounded-full px-5 py-2.5 ${canPost ? 'bg-brand active:bg-brand-dark' : 'bg-white/20'}`}
        >
          <Text className="font-extrabold text-white">{posting ? 'Sending…' : 'Ask friends'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
