-- "Anyone down?" invites: a user posts a casual invite, their friends get a
-- text, and friends can say they're interested and suggest a time and place.

-- Profiles hold the display name friends see and the phone number we text.
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  sms_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "user reads own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "user inserts own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "user updates own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Friendships are mutual and stored in both directions.
create table public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

create policy "user reads own friendships" on public.friendships
  for select to authenticated using (user_id = auth.uid());

-- Friends are added by opening someone's friend link; both rows are written here.
create function public.add_friend(p_friend uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_friend = auth.uid() then raise exception 'You can''t add yourself'; end if;
  if not exists (select 1 from profiles where id = p_friend) then
    raise exception 'That friend link is not valid';
  end if;
  insert into friendships (user_id, friend_id) values (auth.uid(), p_friend), (p_friend, auth.uid())
    on conflict do nothing;
end $$;

create function public.remove_friend(p_friend uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from friendships
  where (user_id = auth.uid() and friend_id = p_friend)
     or (user_id = p_friend and friend_id = auth.uid())
$$;

-- Friends see each other's names, never phone numbers.
create function public.list_friends()
returns table (id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name from friendships f join profiles p on p.id = f.friend_id
  where f.user_id = auth.uid() order by p.name
$$;

-- Shown on a friend link before you accept it.
create function public.get_profile_name(p_id uuid)
returns text
language sql stable security definer set search_path = public
as $$ select name from profiles where id = p_id $$;

grant execute on function public.add_friend(uuid), public.remove_friend(uuid), public.list_friends(),
  public.get_profile_name(uuid) to authenticated;

-- An invite is a short casual message, visible to the host and their friends.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  host_name text not null check (char_length(host_name) between 1 and 60),
  message text not null check (char_length(message) between 1 and 200),
  sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_host_created_idx on public.invites (host_id, created_at desc);

alter table public.invites enable row level security;

create policy "host or friend reads invite" on public.invites
  for select to authenticated using (
    host_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = invites.host_id
    )
  );
create policy "host inserts own invite" on public.invites
  for insert to authenticated with check (host_id = auth.uid());
create policy "host deletes own invite" on public.invites
  for delete to authenticated using (host_id = auth.uid());

-- A response means "I'm interested", optionally with a suggested time and place.
create table public.invite_responses (
  invite_id uuid not null references public.invites (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  suggested_time text check (char_length(suggested_time) <= 60),
  suggested_place text check (char_length(suggested_place) <= 120),
  host_notified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

alter table public.invite_responses enable row level security;

-- Readable by anyone who can see the invite (RLS on invites applies inside the subquery).
create policy "invite viewers read responses" on public.invite_responses
  for select to authenticated using (
    exists (select 1 from public.invites i where i.id = invite_responses.invite_id)
  );
create policy "friend inserts own response" on public.invite_responses
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.invites i where i.id = invite_responses.invite_id)
  );
create policy "user updates own response" on public.invite_responses
  for update to authenticated using (user_id = auth.uid());
create policy "user deletes own response" on public.invite_responses
  for delete to authenticated using (user_id = auth.uid());

-- sms_sent_at and host_notified_at are only written by the notify-invite edge
-- function (service role), so clients get column-level write grants without them.
revoke insert, update on public.invites from authenticated, anon;
grant insert (host_id, host_name, message) on public.invites to authenticated;
revoke insert, update on public.invite_responses from authenticated, anon;
grant insert (invite_id, user_id, name, suggested_time, suggested_place, updated_at),
  update (name, suggested_time, suggested_place, updated_at)
  on public.invite_responses to authenticated;

alter publication supabase_realtime add table public.invite_responses;
