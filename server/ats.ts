import { isProductLeadershipTitle, type AtsConfig, type AtsKind, type ScannedJob } from "../shared/jobs.js";

const UA = { "user-agent": "CareerHub/1.0 (personal job tracker)", accept: "application/json" };
const MAX_DETAILS = 12;

function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const decoded = html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return decoded
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return (await res.json()) as T;
}

async function greenhouse(cfg: AtsConfig, kw?: string[]): Promise<{ scanned: number; jobs: ScannedJob[] }> {
  type GH = { jobs: { id: number; title: string; absolute_url: string; location?: { name: string }; updated_at?: string; first_published?: string; content?: string }[] };
  const data = await getJson<GH>(`https://boards-api.greenhouse.io/v1/boards/${cfg.slug}/jobs?content=true`);
  const jobs = data.jobs
    .filter((j) => isProductLeadershipTitle(j.title, kw))
    .map((j) => ({
      external_id: String(j.id),
      title: j.title,
      url: j.absolute_url,
      location: j.location?.name ?? null,
      posted_at: j.first_published ?? j.updated_at ?? null,
      description: htmlToText(j.content),
      comp_min: null,
      comp_max: null,
    }));
  return { scanned: data.jobs.length, jobs };
}

async function lever(cfg: AtsConfig, kw?: string[]): Promise<{ scanned: number; jobs: ScannedJob[] }> {
  type LV = {
    id: string;
    text: string;
    hostedUrl: string;
    createdAt?: number;
    categories?: { location?: string; allLocations?: string[] };
    descriptionPlain?: string;
    lists?: { text: string; content: string }[];
    additionalPlain?: string;
    salaryRange?: { min?: number; max?: number };
  }[];
  const data = await getJson<LV>(`https://api.lever.co/v0/postings/${cfg.slug}?mode=json`);
  const jobs = data
    .filter((j) => isProductLeadershipTitle(j.text, kw))
    .map((j) => ({
      external_id: j.id,
      title: j.text,
      url: j.hostedUrl,
      location: j.categories?.allLocations?.join("; ") ?? j.categories?.location ?? null,
      posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      description: [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`), j.additionalPlain]
        .filter(Boolean)
        .join("\n\n"),
      comp_min: j.salaryRange?.min ?? null,
      comp_max: j.salaryRange?.max ?? null,
    }));
  return { scanned: data.length, jobs };
}

async function ashby(cfg: AtsConfig, kw?: string[]): Promise<{ scanned: number; jobs: ScannedJob[] }> {
  type AB = {
    jobs: {
      id: string;
      title: string;
      jobUrl: string;
      location?: string;
      isRemote?: boolean;
      publishedAt?: string;
      descriptionPlain?: string;
      compensation?: { summaryComponents?: { compensationType: string; minValue?: number; maxValue?: number }[] };
    }[];
  };
  const data = await getJson<AB>(`https://api.ashbyhq.com/posting-api/job-board/${cfg.slug}?includeCompensation=true`);
  const jobs = data.jobs
    .filter((j) => isProductLeadershipTitle(j.title, kw))
    .map((j) => {
      const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary");
      return {
        external_id: j.id,
        title: j.title,
        url: j.jobUrl,
        location: [j.location, j.isRemote ? "Remote" : null].filter(Boolean).join(" · ") || null,
        posted_at: j.publishedAt ?? null,
        description: j.descriptionPlain ?? null,
        comp_min: salary?.minValue ?? null,
        comp_max: salary?.maxValue ?? null,
      };
    });
  return { scanned: data.jobs.length, jobs };
}

async function workday(cfg: AtsConfig, kw?: string[]): Promise<{ scanned: number; jobs: ScannedJob[] }> {
  if (!cfg.host || !cfg.tenant || !cfg.site) throw new Error("Workday needs host, tenant and site");
  const base = `https://${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}`;
  type WDList = { total: number; jobPostings: { title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] }[] };
  const found: WDList["jobPostings"] = [];
  let scanned = 0;
  for (const searchText of ["product director", "head of product", "group product manager"]) {
    for (let offset = 0; offset < 60; offset += 20) {
      const page = await getJson<WDList>(`${base}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
      });
      scanned += page.jobPostings.length;
      for (const p of page.jobPostings) if (!found.some((f) => f.externalPath === p.externalPath)) found.push(p);
      if (offset + 20 >= page.total) break;
    }
  }
  const matches = found.filter((p) => isProductLeadershipTitle(p.title, kw)).slice(0, MAX_DETAILS);
  type WDDetail = { jobPostingInfo: { id?: string; jobReqId?: string; jobDescription?: string; location?: string; externalUrl?: string; startDate?: string } };
  const jobs = await Promise.all(
    matches.map(async (p) => {
      const d = await getJson<WDDetail>(`${base}${p.externalPath}`).catch(() => null);
      const info = d?.jobPostingInfo;
      return {
        external_id: info?.jobReqId ?? p.bulletFields?.[0] ?? p.externalPath,
        title: p.title,
        url: info?.externalUrl ?? `https://${cfg.host}/${cfg.site}${p.externalPath}`,
        location: info?.location ?? p.locationsText ?? null,
        posted_at: info?.startDate ?? null,
        description: htmlToText(info?.jobDescription),
        comp_min: null,
        comp_max: null,
      };
    }),
  );
  return { scanned, jobs };
}

export const ADAPTERS: Record<AtsKind, (cfg: AtsConfig, kw?: string[]) => Promise<{ scanned: number; jobs: ScannedJob[] }>> = {
  greenhouse,
  lever,
  ashby,
  workday,
};
