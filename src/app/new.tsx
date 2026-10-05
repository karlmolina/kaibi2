import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { createEvent } from '@/lib/events';
import { notify } from '@/lib/notify';

function defaultStart() {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function NewEventScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  async function save() {
    setSaving(true);
    try {
      const event = await createEvent({ title, description, location, starts_at: startsAt });
      router.replace({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e) {
      notify('Could not create event', e instanceof Error ? e.message : 'Try again');
      setSaving(false);
    }
  }

  const input = 'rounded-xl bg-white/10 px-4 py-3 text-base text-white';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-night">
      <ScrollView contentContainerClassName="w-full max-w-2xl gap-5 self-center p-5" keyboardShouldPersistTaps="handled">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Event name"
          placeholderTextColor="#ffffff66"
          maxLength={120}
          className="text-3xl font-extrabold text-white"
          autoFocus
        />
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase text-white/50">When</Text>
          <DateTimeField value={startsAt} onChange={setStartsAt} />
        </View>
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase text-white/50">Where</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Location"
            placeholderTextColor="#ffffff66"
            className={input}
          />
        </View>
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase text-white/50">Details</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's the vibe?"
            placeholderTextColor="#ffffff66"
            multiline
            className={`${input} min-h-28`}
            textAlignVertical="top"
          />
        </View>
        <Pressable
          disabled={!canSave}
          onPress={save}
          className={`items-center rounded-full py-4 ${canSave ? 'bg-brand active:bg-brand-dark' : 'bg-white/20'}`}
        >
          <Text className="text-lg font-extrabold text-white">{saving ? 'Creating…' : 'Create event'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
