import * as Linking from 'expo-linking';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  name: string;
  phone: string | null;
  sms_opt_in: boolean;
};

export type Friend = { id: string; name: string };

/** Make sure the signed-in user has a profile row so friends can see their name. */
export async function ensureProfile(userId: string, name: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name: name.slice(0, 60) }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.warn('Could not create profile', error);
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Normalizes what people type into E.164. Ten-digit numbers are assumed to be US/Canada.
 * Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('list_friends');
  if (error) throw error;
  return data as Friend[];
}

export async function getProfileName(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_profile_name', { p_id: id });
  if (error) throw error;
  return data as string | null;
}

export async function addFriend(id: string) {
  const { error } = await supabase.rpc('add_friend', { p_friend: id });
  if (error) throw error;
}

export async function removeFriend(id: string) {
  const { error } = await supabase.rpc('remove_friend', { p_friend: id });
  if (error) throw error;
}

export const friendLink = (userId: string) => Linking.createURL(`/friend/${userId}`);
