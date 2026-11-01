-- Saath: account-wide read status for match messages
-- Run this once in Supabase SQL Editor for the same project used by the website.

create table if not exists public.message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.message_reads enable row level security;

drop policy if exists "Users can view their own message read markers" on public.message_reads;
create policy "Users can view their own message read markers"
on public.message_reads for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their own message read markers" on public.message_reads;
create policy "Users can create their own message read markers"
on public.message_reads for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

drop policy if exists "Users can update their own message read markers" on public.message_reads;
create policy "Users can update their own message read markers"
on public.message_reads for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

grant select, insert, update on public.message_reads to authenticated;
