create table if not exists public.shared_years (
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null check (year between 1900 and 2100),
  created_at timestamptz not null default now(),
  primary key (user_id, year)
);
alter table public.shared_years enable row level security;
drop policy if exists "Shared years are readable by everyone" on public.shared_years;
drop policy if exists "Users can share their own years" on public.shared_years;
drop policy if exists "Users can unshare their own years" on public.shared_years;
create policy "Shared years are readable by everyone"
  on public.shared_years for select using (true);
create policy "Users can share their own years"
  on public.shared_years for insert with check (auth.uid() = user_id);
create policy "Users can unshare their own years"
  on public.shared_years for delete using (auth.uid() = user_id);
