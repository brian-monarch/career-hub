-- Career Hub: fit-score boosts and application documents.

-- Things that make a company worth a look outside his core domains
-- (e.g. well respected, Twin Cities, tech-oriented, sports/golf/travel).
alter table public.search_profile
  add column if not exists boosts text;

-- Base resume and every tailored resume / cover letter, versioned.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  posting_id uuid references public.postings on delete cascade,
  kind text not null check (kind in ('base_resume', 'resume', 'cover_letter')),
  title text,
  content text not null,
  detail jsonb,                         -- model notes: changes made, keyword coverage
  model text,
  created_at timestamptz not null default now()
);

select public.ch_enable_owner_rls('public.documents');
create index on public.documents (user_id, kind, created_at desc);
create index on public.documents (posting_id);
