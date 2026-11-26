-- Career Hub: job finder.
-- Search preferences (one row per user), ATS settings on watchlist companies,
-- and an inbox of matches found by scans or pasted in by hand.

create table public.search_profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  headline text,                        -- who he is, in two or three sentences
  target_titles text[] not null default '{}',
  target_levels text[] not null default '{}',
  domains text[] not null default '{}',  -- e.g. retail media, measurement, data platforms
  locations text[] not null default '{}',
  remote_ok boolean not null default true,
  max_travel_pct smallint,
  comp_floor_ideal integer,             -- total comp he'd accept for an ideal role
  comp_floor_good integer,              -- total comp he needs for a merely good role
  must_haves text,
  deal_breakers text,
  updated_at timestamptz not null default now()
);

create trigger search_profile_touch before update on public.search_profile
  for each row execute function public.ch_touch_updated_at();

alter table public.companies
  add column careers_url text,
  add column ats text check (ats in ('greenhouse', 'lever', 'ashby', 'workday', 'other')),
  add column ats_config jsonb,           -- {slug} or {host, tenant, site} for Workday
  add column last_scanned_at timestamptz;

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid references public.companies on delete set null,
  company_name text not null,
  source text not null,                 -- greenhouse | lever | ashby | workday | pasted
  external_id text,                     -- id at the source, for de-duplication
  title text not null,
  url text,
  location text,
  posted_at timestamptz,
  description text,
  comp_min integer,
  comp_max integer,
  fit_score smallint check (fit_score between 1 and 10),
  fit_summary text,
  fit_detail jsonb,
  status text not null default 'new' check (status in ('new', 'promoted', 'dismissed')),
  dismiss_reason text,
  posting_id uuid references public.postings on delete set null,
  found_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

select public.ch_enable_owner_rls('public.search_profile');
select public.ch_enable_owner_rls('public.job_matches');

alter table public.postings
  add column fit_detail jsonb,
  add column description text;

create index on public.job_matches (user_id, status, fit_score desc);
