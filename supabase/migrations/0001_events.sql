create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  location text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  status text not null check (status in ('going', 'maybe', 'cant')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index events_starts_at_idx on public.events (starts_at);

alter table public.events enable row level security;
alter table public.rsvps enable row level security;

-- Events are link-shareable: anyone can read, only the host can write.
create policy "events are readable" on public.events
  for select using (true);
create policy "host inserts own events" on public.events
  for insert to authenticated with check (host_id = auth.uid());
create policy "host updates own events" on public.events
  for update to authenticated using (host_id = auth.uid());
create policy "host deletes own events" on public.events
  for delete to authenticated using (host_id = auth.uid());

-- RSVPs are visible to guests; each user manages only their own.
create policy "rsvps are readable" on public.rsvps
  for select using (true);
create policy "user inserts own rsvp" on public.rsvps
  for insert to authenticated with check (user_id = auth.uid());
create policy "user updates own rsvp" on public.rsvps
  for update to authenticated using (user_id = auth.uid());
create policy "user deletes own rsvp" on public.rsvps
  for delete to authenticated using (user_id = auth.uid());
