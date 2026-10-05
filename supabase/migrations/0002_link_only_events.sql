-- Events are only discoverable by link: direct table reads are limited to your
-- own events (hosted or RSVP'd). Anyone with an event's id fetches it via RPC.
drop policy "events are readable" on public.events;
drop policy "rsvps are readable" on public.rsvps;

create policy "host or guest reads event" on public.events
  for select to authenticated using (
    host_id = auth.uid()
    or exists (
      select 1 from public.rsvps r
      where r.event_id = events.id and r.user_id = auth.uid()
    )
  );

create policy "user reads own rsvps" on public.rsvps
  for select to authenticated using (user_id = auth.uid());

create function public.get_event(p_id uuid)
returns setof public.events
language sql stable security definer set search_path = public
as $$ select * from public.events where id = p_id $$;

create function public.get_event_rsvps(p_id uuid)
returns setof public.rsvps
language sql stable security definer set search_path = public
as $$ select * from public.rsvps where event_id = p_id order by updated_at $$;

grant execute on function public.get_event(uuid), public.get_event_rsvps(uuid)
  to anon, authenticated;
