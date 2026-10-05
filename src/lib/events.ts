import { supabase } from './supabase';

export type RsvpStatus = 'going' | 'maybe' | 'cant';

export type Event = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  created_at: string;
};

export type Rsvp = {
  event_id: string;
  user_id: string;
  name: string;
  status: RsvpStatus;
};

export async function listEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('starts_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getEvent(id: string): Promise<Event> {
  const { data, error } = await supabase.rpc('get_event', { p_id: id }).single();
  if (error) throw error;
  return data as Event;
}

export async function createEvent(input: {
  title: string;
  description?: string;
  location?: string;
  starts_at: Date;
}): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      starts_at: input.starts_at.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRsvps(eventId: string): Promise<Rsvp[]> {
  const { data, error } = await supabase.rpc('get_event_rsvps', { p_id: eventId });
  if (error) throw error;
  return data as Rsvp[];
}

export async function setRsvp(eventId: string, name: string, status: RsvpStatus) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('rsvps')
    .upsert(
      { event_id: eventId, user_id: auth.user.id, name: name.trim(), status, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' },
    );
  if (error) throw error;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
