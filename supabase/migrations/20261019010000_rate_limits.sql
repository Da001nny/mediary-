create table if not exists public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits int;
begin
  v_window := to_timestamp(
    (floor(extract(epoch from pg_catalog.now()) / p_window_seconds)
     * p_window_seconds)::double precision);
  insert into public.api_rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if random() < 0.02 then
    delete from public.api_rate_limits
    where window_start < pg_catalog.now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end
$$;
revoke all on function public.check_rate_limit(text, int, int)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int)
  to service_role;
