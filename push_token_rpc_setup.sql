-- Run this in Supabase SQL Editor.
-- Safely registers the current device token to the currently signed-in user.
create or replace function public.register_push_token(
  p_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to register a push token';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Push token is required';
  end if;

  if p_platform not in ('android', 'web') then
    raise exception 'Invalid push platform';
  end if;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
