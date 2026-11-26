-- Career Hub: initial schema (all v1 tables).
-- Every row belongs to one auth user; row-level security restricts every table to its owner.
-- Paste into Supabase > SQL Editor and run once, or apply with `supabase db push`.

create extension if not exists "pgcrypto";

-- Helper: owner column default + RLS policy for each table.
create or replace function public.ch_enable_owner_rls(tbl regclass) returns void
language plpgsql as $$
begin
  execute format('alter table %s enable row level security', tbl);
  execute format('create policy "owner can do everything" on %s for all to authenticated
                  using (user_id = auth.uid()) with check (user_id = auth.uid())', tbl);
end $$;

create or replace function public.ch_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Prepare: story bank & coach ─────────────────────────

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  pillar text,
  situation text,
  task text,
  action text,
  result text,
  metrics text,
  my_decision text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null,
  category text not null default 'behavioral'
    check (category in ('behavioral', 'product_sense', 'strategy', 'data', 'leadership', 'other')),
  source text not null default 'library',
  story_id uuid references public.stories on delete set null,
  created_at timestamptz not null default now()
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mode text not null default 'mock' check (mode in ('solo', 'mock')),
  persona text not null default 'hiring_manager',
  posting_id uuid,
  started_at timestamptz not null default now()
);

create table public.takes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid references public.practice_sessions on delete cascade,
  question_id uuid references public.questions on delete set null,
  question_text text not null,
  story_id uuid references public.stories on delete set null,
  is_probe boolean not null default false,
  audio_path text,
  transcript text not null,
  duration_s integer,
  words_per_min integer,
  filler_count integer,
  we_count integer,
  i_count integer,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  take_id uuid not null references public.takes on delete cascade,
  overall numeric(3,1),
  score_structure smallint check (score_structure between 1 and 5),
  score_specificity smallint check (score_specificity between 1 and 5),
  score_impact smallint check (score_impact between 1 and 5),
  score_ownership smallint check (score_ownership between 1 and 5),
  score_relevance smallint check (score_relevance between 1 and 5),
  score_length smallint check (score_length between 1 and 5),
  detail jsonb not null,           -- full structured response from the coach
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Search: CRM & pipeline ─────────────────────────

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  segment text,
  size text,
  location_policy text,
  archetype_fit smallint check (archetype_fit between 1 and 5),
  watchlist boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid references public.companies on delete set null,
  title text not null,
  level text,
  url text,
  comp_min integer,
  comp_max integer,
  location text,
  source text,
  found_at date default current_date,
  fit_score smallint check (fit_score between 1 and 10),
  fit_rationale text,
  stage text not null default 'identified'
    check (stage in ('identified', 'networking', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'closed')),
  stage_changed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.practice_sessions
  add constraint practice_sessions_posting_fk foreign key (posting_id) references public.postings on delete set null;

create table public.stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  posting_id uuid not null references public.postings on delete cascade,
  from_stage text,
  to_stage text not null,
  at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid references public.companies on delete set null,
  name text not null,
  title text,
  relationship text check (relationship in ('recruiter', 'hiring_manager', 'peer', 'referral', 'other')),
  warmth smallint check (warmth between 1 and 3),
  linkedin_url text,
  email text,
  last_touch_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contact_id uuid references public.contacts on delete set null,
  posting_id uuid references public.postings on delete set null,
  type text not null check (type in ('call', 'email', 'message', 'coffee', 'interview', 'other')),
  occurred_at timestamptz not null default now(),
  summary text,
  next_action text,
  next_action_due date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.interview_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  posting_id uuid not null references public.postings on delete cascade,
  name text not null,
  scheduled_at timestamptz,
  interviewers text,
  outcome text check (outcome in ('pending', 'advanced', 'rejected', 'withdrew')),
  debrief text,
  created_at timestamptz not null default now()
);

-- Record every stage move so time-in-stage and funnel metrics are measurable.
create or replace function public.ch_log_stage_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stage_events (user_id, posting_id, from_stage, to_stage) values (new.user_id, new.id, null, new.stage);
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at = now();
    insert into public.stage_events (user_id, posting_id, from_stage, to_stage) values (new.user_id, new.id, old.stage, new.stage);
  end if;
  return new;
end $$;

create trigger postings_stage_insert after insert on public.postings
  for each row execute function public.ch_log_stage_change();
create trigger postings_stage_update before update on public.postings
  for each row execute function public.ch_log_stage_change();

create trigger stories_touch before update on public.stories for each row execute function public.ch_touch_updated_at();
create trigger companies_touch before update on public.companies for each row execute function public.ch_touch_updated_at();
create trigger postings_touch before update on public.postings for each row execute function public.ch_touch_updated_at();
create trigger contacts_touch before update on public.contacts for each row execute function public.ch_touch_updated_at();

-- RLS on every table.
select public.ch_enable_owner_rls(t) from unnest(array[
  'public.stories', 'public.questions', 'public.practice_sessions', 'public.takes', 'public.feedback',
  'public.companies', 'public.postings', 'public.stage_events', 'public.contacts',
  'public.interactions', 'public.interview_rounds'
]::regclass[]) as t;

-- Helpful indexes.
create index on public.takes (user_id, created_at desc);
create index on public.takes (story_id);
create index on public.feedback (take_id);
create index on public.postings (user_id, stage);
create index on public.interactions (user_id, next_action_due) where not done;
create index on public.stage_events (posting_id, at);
