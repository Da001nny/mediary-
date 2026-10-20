alter table public.profiles alter column default_privacy set default 'private';
alter table public.entries alter column privacy set default 'private';
alter table public.lists alter column privacy set default 'private';
