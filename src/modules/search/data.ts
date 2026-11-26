import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/platform/data/supabase";
import { callApi } from "@/platform/data/api";
import type { Company, JobMatch, Posting, SearchProfileRow, Stage } from "@/platform/data/types";
import type { Fit, ScanResponse, ScoreResponse, SearchProfile } from "@shared/jobs";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function userId() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not signed in.");
  return data.session.user.id;
}

/* ───────────── Search profile ───────────── */

export const EMPTY_PROFILE: SearchProfileRow = {
  headline: "",
  target_titles: [],
  target_levels: [],
  domains: [],
  locations: [],
  remote_ok: true,
  max_travel_pct: null,
  comp_floor_ideal: null,
  comp_floor_good: null,
  must_haves: "",
  deal_breakers: "",
  boosts: "",
};

export function useProfile() {
  return useQuery({
    queryKey: ["search_profile"],
    queryFn: async () => unwrap<SearchProfileRow | null>(await supabase.from("search_profile").select("*").maybeSingle()),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: SearchProfileRow) =>
      unwrap(await supabase.from("search_profile").upsert({ ...p, user_id: await userId() }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search_profile"] }),
  });
}

export function profileComplete(p: SearchProfileRow | null | undefined): p is SearchProfileRow {
  return Boolean(p && p.target_titles.length && p.locations.length);
}

/* ───────────── Companies / watchlist ───────────── */

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => unwrap<Company[]>(await supabase.from("companies").select("*").order("name")),
  });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...c }: Partial<Company> & { name: string }) => {
      const q = id ? supabase.from("companies").update(c).eq("id", id) : supabase.from("companies").insert(c);
      return unwrap(await q.select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from("companies").delete().eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

/* ───────────── Matches (inbox) ───────────── */

export function useMatches() {
  return useQuery({
    queryKey: ["job_matches"],
    queryFn: async () =>
      unwrap<JobMatch[]>(
        await supabase
          .from("job_matches")
          .select("*")
          .order("fit_score", { ascending: false, nullsFirst: true })
          .order("found_at", { ascending: false })
          .limit(300),
      ),
  });
}

async function recentDismissals() {
  const { data } = await supabase
    .from("job_matches")
    .select("title, company_name, dismiss_reason")
    .eq("status", "dismissed")
    .order("found_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((d) => ({ title: d.title as string, company: d.company_name as string, reason: (d.dismiss_reason as string | null) ?? null }));
}

async function scoreMatch(profile: SearchProfile, m: Pick<JobMatch, "id" | "title" | "company_name" | "url" | "location" | "description">) {
  if (!m.description || m.description.length < 40) return null;
  const res = await callApi<ScoreResponse>("/api/jobs-score", {
    profile,
    dismissals: await recentDismissals(),
    posting: { title: m.title, company: m.company_name, url: m.url ?? undefined, location: m.location ?? undefined, description: m.description.slice(0, 60000) },
  });
  const f = res.fit;
  unwrap(
    await supabase
      .from("job_matches")
      .update({
        fit_score: f.fit_score,
        fit_summary: f.headline,
        fit_detail: f,
        comp_min: f.parsed.comp_min,
        comp_max: f.parsed.comp_max,
      })
      .eq("id", m.id),
  );
  return f;
}

/** Runs fn over items with limited concurrency. */
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<unknown>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!).catch(() => null);
    }),
  );
}

export type ScanProgress = { phase: "scanning" | "scoring" | "done"; found: number; scored: number; errors: string[] };

export async function scanWatchlist(
  companies: Company[],
  profile: SearchProfile,
  onProgress: (p: ScanProgress) => void,
): Promise<ScanProgress> {
  const targets = companies.filter((c) => c.watchlist && c.ats && c.ats !== "other" && c.ats_config);
  const progress: ScanProgress = { phase: "scanning", found: 0, scored: 0, errors: [] };
  onProgress({ ...progress });

  const res = await callApi<ScanResponse>("/api/jobs-scan", {
    companies: targets.map((c) => ({ id: c.id, name: c.name, ats: c.ats, ats_config: c.ats_config })),
  });
  const uid = await userId();
  const fresh: JobMatch[] = [];
  for (const r of res.results) {
    const company = targets.find((c) => c.id === r.company_id)!;
    if (r.error) progress.errors.push(`${company.name}: ${r.error}`);
    await supabase.from("companies").update({ last_scanned_at: new Date().toISOString() }).eq("id", company.id);
    if (!r.jobs.length) continue;
    const rows = r.jobs.map((j) => ({ ...j, user_id: uid, company_id: company.id, company_name: company.name, source: company.ats! }));
    const { data, error } = await supabase
      .from("job_matches")
      .upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
      .select();
    if (error) progress.errors.push(`${company.name}: ${error.message}`);
    fresh.push(...((data as JobMatch[] | null) ?? []));
  }
  progress.found = fresh.length;
  progress.phase = "scoring";
  onProgress({ ...progress });

  await pool(fresh, 3, async (m) => {
    await scoreMatch(profile, m);
    progress.scored++;
    onProgress({ ...progress });
  });
  progress.phase = "done";
  onProgress({ ...progress });
  return progress;
}

/** Scores a pasted posting and adds it to the inbox. */
export async function addPastedPosting(profile: SearchProfile, input: { url: string; text: string }): Promise<Fit> {
  const res = await callApi<ScoreResponse>("/api/jobs-score", {
    profile,
    dismissals: await recentDismissals(),
    posting: { url: input.url || undefined, description: input.text },
  });
  const f = res.fit;
  unwrap(
    await supabase.from("job_matches").upsert(
      {
        user_id: await userId(),
        company_name: f.parsed.company,
        source: "pasted",
        external_id: input.url || `pasted-${crypto.randomUUID()}`,
        title: f.parsed.title,
        url: input.url || null,
        location: f.parsed.location,
        description: input.text,
        comp_min: f.parsed.comp_min,
        comp_max: f.parsed.comp_max,
        fit_score: f.fit_score,
        fit_summary: f.headline,
        fit_detail: f,
        status: "new",
      },
      { onConflict: "user_id,source,external_id" },
    ),
  );
  return f;
}

export function useRescore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profile, match }: { profile: SearchProfile; match: JobMatch }) => scoreMatch(profile, match),
    onSettled: () => qc.invalidateQueries({ queryKey: ["job_matches"] }),
  });
}

export function useDismissMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) =>
      unwrap(await supabase.from("job_matches").update({ status: "dismissed", dismiss_reason: reason }).eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job_matches"] }),
  });
}

export function useRestoreMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from("job_matches").update({ status: "new", dismiss_reason: null }).eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job_matches"] }),
  });
}

/** Moves a match into the pipeline as an Identified posting, creating the company if needed. */
export function usePromoteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: JobMatch) => {
      let companyId = m.company_id;
      if (!companyId) {
        const existing = unwrap<Company[]>(await supabase.from("companies").select("*").ilike("name", m.company_name).limit(1));
        companyId = existing[0]?.id ?? unwrap<Company>(await supabase.from("companies").insert({ name: m.company_name }).select().single()).id;
      }
      const fit = m.fit_detail as Fit | null;
      const posting = unwrap<Posting>(
        await supabase
          .from("postings")
          .insert({
            company_id: companyId,
            title: m.title,
            level: fit?.parsed.level ?? null,
            url: m.url,
            comp_min: m.comp_min,
            comp_max: m.comp_max,
            location: m.location,
            source: m.source,
            fit_score: m.fit_score,
            fit_rationale: m.fit_summary,
            fit_detail: m.fit_detail,
            description: m.description,
            stage: "identified",
          })
          .select()
          .single(),
      );
      unwrap(await supabase.from("job_matches").update({ status: "promoted", posting_id: posting.id }).eq("id", m.id));
      return posting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_matches"] });
      qc.invalidateQueries({ queryKey: ["postings"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

/* ───────────── Pipeline ───────────── */

export function usePostings() {
  return useQuery({
    queryKey: ["postings"],
    queryFn: async () =>
      unwrap<Posting[]>(await supabase.from("postings").select("*, companies(name)").order("stage_changed_at", { ascending: false })),
  });
}

export function useMovePosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) =>
      unwrap(await supabase.from("postings").update({ stage }).eq("id", id)),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["postings"] });
      const prev = qc.getQueryData<Posting[]>(["postings"]);
      qc.setQueryData<Posting[]>(["postings"], (ps) =>
        ps?.map((p) => (p.id === id ? { ...p, stage, stage_changed_at: new Date().toISOString() } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["postings"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["postings"] }),
  });
}

export function useUpdatePosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Posting> & { id: string }) =>
      unwrap(await supabase.from("postings").update(patch).eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postings"] }),
  });
}

export function useAddPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { company: string; title: string; url?: string; stage: Stage }) => {
      const existing = unwrap<Company[]>(await supabase.from("companies").select("*").ilike("name", p.company).limit(1));
      const companyId = existing[0]?.id ?? unwrap<Company>(await supabase.from("companies").insert({ name: p.company }).select().single()).id;
      return unwrap(
        await supabase.from("postings").insert({ company_id: companyId, title: p.title, url: p.url || null, stage: p.stage, source: "manual" }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["postings"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function profileForApi(p: SearchProfileRow): SearchProfile {
  return { ...p, max_travel_pct: p.max_travel_pct ?? null };
}
