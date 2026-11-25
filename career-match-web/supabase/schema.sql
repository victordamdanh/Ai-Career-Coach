begin;

create table public.career_candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) <= 100),
  email text not null check (length(email) <= 254),
  phone text not null check (length(phone) <= 40),
  resume text not null check (length(trim(resume)) between 1 and 14000)
);

create table public.career_saved_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (length(company) between 1 and 100),
  job_id text not null check (length(job_id) between 1 and 100),
  title text not null check (length(title) between 1 and 300),
  url text not null check (length(url) <= 500 and url ~ '^https://'),
  location text not null check (length(location) <= 300),
  excerpt text not null check (length(excerpt) <= 3000),
  saved_at timestamptz not null default now(),
  primary key (user_id, company, job_id)
);

alter table public.career_candidate_profiles enable row level security;
alter table public.career_saved_jobs enable row level security;
revoke all on public.career_candidate_profiles, public.career_saved_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.career_candidate_profiles, public.career_saved_jobs to authenticated;

create policy career_profile_owner on public.career_candidate_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy career_job_owner on public.career_saved_jobs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.clear_career_account() returns void
language sql security invoker set search_path = '' as $$
  delete from public.career_saved_jobs where user_id = (select auth.uid());
  delete from public.career_candidate_profiles where user_id = (select auth.uid());
$$;
revoke execute on function public.clear_career_account() from public, anon;
grant execute on function public.clear_career_account() to authenticated;

create table public.career_history_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null,
  kind text not null check (kind in ('resume', 'interview')),
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 110000),
  primary key (user_id, record_id),
  check (case when kind = 'resume'
    then coalesce(jsonb_typeof(payload->'text') = 'string'
      and length(trim(payload->>'text')) between 1 and 14000, false)
    else coalesce(jsonb_typeof(payload->'turns') = 'array'
      and jsonb_typeof(payload->'criteria') = 'array'
      and jsonb_typeof(payload->'feedback') = 'array'
      and jsonb_typeof(payload->'score') = 'number'
      and (payload->>'score')::numeric between 0 and 100, false) end)
);
create index career_history_owner_created_idx on public.career_history_records (user_id, created_at desc);
alter table public.career_history_records enable row level security;
revoke all on public.career_history_records from public, anon, authenticated;
grant select, insert, update, delete on public.career_history_records to authenticated;
create policy career_history_owner on public.career_history_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.clear_career_account() returns void
language sql security invoker set search_path = '' as $$
  delete from public.career_history_records where user_id = (select auth.uid());
  delete from public.career_saved_jobs where user_id = (select auth.uid());
  delete from public.career_candidate_profiles where user_id = (select auth.uid());
$$;
revoke execute on function public.clear_career_account() from public, anon;
grant execute on function public.clear_career_account() to authenticated;

commit;
