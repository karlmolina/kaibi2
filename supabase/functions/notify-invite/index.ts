// Sends the SMS side of "anyone down?" invites through Twilio.
//
//   { type: "invite", invite_id }    host just posted: text every opted-in friend
//   { type: "response", invite_id }  caller said they're interested: text the host once
//
// Called by the app right after it writes the row. The caller's JWT is checked,
// and phone numbers are only ever read here with the service role.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
// Either a Messaging Service SID (MG...) or a sending number (+1...).
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
const TWILIO_FROM = Deno.env.get('TWILIO_FROM');

// Keeps one account from blasting its friends.
const MAX_INVITES_PER_HOUR = 5;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const smsConfigured = () => !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_MESSAGING_SERVICE_SID || TWILIO_FROM));

async function sendSms(to: string, body: string) {
  const form = new URLSearchParams({ To: to, Body: body });
  if (TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
  else form.set('From', TWILIO_FROM!);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

const inviteUrl = (id: string) => (APP_URL ? `${APP_URL}/invite/${id}` : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { type, invite_id } = await req.json().catch(() => ({}));
  if (typeof invite_id !== 'string' || (type !== 'invite' && type !== 'response')) {
    return json({ error: 'Expected { type: "invite" | "response", invite_id }' }, 400);
  }

  const { data: invite } = await admin.from('invites').select('*').eq('id', invite_id).maybeSingle();
  if (!invite) return json({ error: 'Invite not found' }, 404);

  if (!smsConfigured()) {
    console.warn('notify-invite: Twilio env vars are not set, skipping SMS');
    return json({ sent: 0, skipped: 'sms_not_configured' });
  }

  if (type === 'invite') {
    if (invite.host_id !== user.id) return json({ error: 'Only the host can send this invite' }, 403);
    if (invite.sms_sent_at) return json({ sent: 0, skipped: 'already_sent' });

    const { count } = await admin
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', user.id)
      .not('sms_sent_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= MAX_INVITES_PER_HOUR) return json({ sent: 0, skipped: 'rate_limited' });

    // Claim the invite first so a retry can't double-text everyone.
    const { data: claimed } = await admin
      .from('invites')
      .update({ sms_sent_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('sms_sent_at', null)
      .select('id');
    if (!claimed?.length) return json({ sent: 0, skipped: 'already_sent' });

    const { data: friendRows } = await admin.from('friendships').select('friend_id').eq('user_id', user.id);
    const friendIds = (friendRows ?? []).map((f) => f.friend_id);
    if (!friendIds.length) return json({ sent: 0 });

    const { data: recipients } = await admin
      .from('profiles')
      .select('phone')
      .in('id', friendIds)
      .eq('sms_opt_in', true)
      .not('phone', 'is', null);

    const link = inviteUrl(invite.id);
    const body = `${invite.host_name} on kaibi: "${invite.message}"${link ? `\nDown? Tap to say you're in: ${link}` : ''}\nReply STOP to opt out.`;
    const results = await Promise.allSettled((recipients ?? []).map((r) => sendSms(r.phone!, body)));
    results.forEach((r) => r.status === 'rejected' && console.error(r.reason));
    return json({ sent: results.filter((r) => r.status === 'fulfilled').length, failed: results.filter((r) => r.status === 'rejected').length });
  }

  // type === 'response'
  if (invite.host_id === user.id) return json({ sent: 0 });
  const { data: claimed } = await admin
    .from('invite_responses')
    .update({ host_notified_at: new Date().toISOString() })
    .eq('invite_id', invite.id)
    .eq('user_id', user.id)
    .is('host_notified_at', null)
    .select('*');
  const response = claimed?.[0];
  if (!response) return json({ sent: 0, skipped: 'already_notified' });

  const { data: host } = await admin.from('profiles').select('phone, sms_opt_in').eq('id', invite.host_id).maybeSingle();
  if (!host?.phone || !host.sms_opt_in) return json({ sent: 0 });

  const suggestion = [response.suggested_time, response.suggested_place && `at ${response.suggested_place}`]
    .filter(Boolean)
    .join(' ');
  const link = inviteUrl(invite.id);
  const body = `${response.name} is down for "${invite.message}"${suggestion ? `. Suggests: ${suggestion}` : ''}${link ? `\n${link}` : ''}`;
  try {
    await sendSms(host.phone, body);
    return json({ sent: 1 });
  } catch (e) {
    console.error(e);
    return json({ sent: 0, failed: 1 });
  }
});
