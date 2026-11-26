import { supabase } from './supabase';

export type Invite = {
  id: string;
  host_id: string;
  host_name: string;
  message: string;
  sms_sent_at: string | null;
  created_at: string;
};

export type InviteResponse = {
  invite_id: string;
  user_id: string;
  name: string;
  suggested_time: string | null;
  suggested_place: string | null;
  updated_at: string;
};

/** Invites stay on the home screen for a day; they're meant for "tonight"-style plans. */
const INVITE_TTL_MS = 24 * 3600_000;

/** Recent invites from you and your friends (RLS limits what's visible). */
export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .gte('created_at', new Date(Date.now() - INVITE_TTL_MS).toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvite(id: string): Promise<Invite> {
  const { data, error } = await supabase.from('invites').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Texting is best-effort: a failure here never undoes the post or the response. */
async function notify(type: 'invite' | 'response', inviteId: string) {
  const { error } = await supabase.functions.invoke('notify-invite', { body: { type, invite_id: inviteId } });
  if (error) console.warn('notify-invite failed', error);
}

export async function createInvite(hostName: string, message: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .insert({ host_name: hostName.trim(), message: message.trim() })
    .select()
    .single();
  if (error) throw error;
  await notify('invite', data.id);
  return data;
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

export async function listResponses(inviteId: string): Promise<InviteResponse[]> {
  const { data, error } = await supabase
    .from('invite_responses')
    .select('*')
    .eq('invite_id', inviteId)
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function respondToInvite(
  inviteId: string,
  input: { name: string; suggested_time?: string; suggested_place?: string },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { error } = await supabase.from('invite_responses').upsert(
    {
      invite_id: inviteId,
      user_id: auth.user.id,
      name: input.name.trim(),
      suggested_time: input.suggested_time?.trim() || null,
      suggested_place: input.suggested_place?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'invite_id,user_id' },
  );
  if (error) throw error;
  await notify('response', inviteId);
}

export async function withdrawResponse(inviteId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('invite_responses')
    .delete()
    .eq('invite_id', inviteId)
    .eq('user_id', auth.user.id);
  if (error) throw error;
}

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
