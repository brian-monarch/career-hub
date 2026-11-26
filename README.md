# Career Hub

A private web app for running a Director of Product search end to end: a job finder that scans target companies' job boards and scores each role against your preferences, a pipeline board, and an AI mock-interview coach. Next: resume and cover-letter tailoring.

**Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, row-level security), Vercel (hosting and serverless functions), Claude API.

## Layout

```
src/
  platform/        shared by every module: auth, Supabase client and queries, design system
  modules/
    apply/         tailored resumes and cover letters per role
    search/        discover (scan + paste + fit score), pipeline Kanban, watchlist, preferences
    coach/         mock interview, rubric feedback, progress
    stories/       hero-story bank in STAR form
  modules/registry.tsx   one entry per module; drives nav and routes
shared/            schemas shared by the browser and the API (coach rubric, fit score, job-board detection)
server/            server-only helpers: session check, job-board adapters (Greenhouse, Lever, Ashby, Workday)
api/coach.ts       scores an interview answer with Claude
api/jobs-scan.ts   pulls product-leadership roles from watchlist companies' public job boards
api/jobs-score.ts  extracts a posting's details and scores fit 1-10 against your search preferences
api/tailor.ts      tailors the base resume or writes a cover letter for a pipeline role (facts from the base resume only)
api/inbound-email.ts  receives forwarded job alert emails (via workers/email-ingest.js on Cloudflare) and adds the jobs to Discover
supabase/migrations/   SQL schema (all v1 tables, RLS on every table)
```

Each job to be done is its own module sharing one login, one database and one design system, so a module can later be split into its own app (or a home hub can reuse `src/platform`).

## How the coach works

1. Pick an interviewer persona, a question (library or your own), and optionally the hero story you plan to use and the target role.
2. Answer by voice (browser speech-to-text, Chrome/Edge/Safari) or by typing. The timer, word count, pace, filler words and the we/I ratio update live.
3. `api/coach.ts` sends the answer, the rubric, the chosen story and the posting to Claude and gets back typed JSON: six 1-5 scores with evidence, the missing proof point, every "we" that should be "I", a tighter rewrite, and one follow-up probe.
4. "Answer the follow-up" turns the probe into the next question, with earlier answers as context.
5. Every take and its feedback are saved; Progress shows the rubric trend and which stories are interview-ready (three answers at 4.0+).

## Setup

### 1. Database
Supabase dashboard > SQL Editor > New query: paste each file in `supabase/migrations/` in name order and Run.

### 2. Auth
Supabase > Authentication > URL Configuration:
- Site URL: the production Vercel URL
- Redirect URLs: add `https://*-monarch-ai2.vercel.app/**` (preview deploys) and `http://localhost:5173/**`

After your first sign-in, turn off new sign-ups: Authentication > Sign In / Providers > "Allow new users to sign up" off.

### 3. Vercel environment variables
Vercel > career-hub > Settings > Environment Variables (all environments):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://qhmohtyjvgasmabfggdp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Project Settings > API Keys > `anon` / publishable key |
| `ANTHROPIC_API_KEY` | Anthropic Console > API Keys (set a monthly spend limit) |
| `ALLOWED_EMAILS` | your email; only these accounts can call the coach |

Redeploy after adding them.

### Local development
```
cp .env.example .env.local   # fill in values
npm install
npx vercel dev               # runs the app and /api together
```
`npm run dev` runs the front end alone (the coach needs `/api`).

## Privacy
No real career material lives in this repo. Stories, transcripts and feedback live only in the Supabase database, readable only with your session (row-level security on every table).
