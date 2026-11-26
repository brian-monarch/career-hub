import { z } from "zod";

/** Search preferences, stored per user in public.search_profile. */
export const SearchProfileSchema = z.object({
  headline: z.string().nullish(),
  target_titles: z.array(z.string()).default([]),
  target_levels: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remote_ok: z.boolean().default(true),
  max_travel_pct: z.number().nullish(),
  comp_floor_ideal: z.number().nullish(),
  comp_floor_good: z.number().nullish(),
  must_haves: z.string().nullish(),
  deal_breakers: z.string().nullish(),
  boosts: z.string().nullish(),
});
export type SearchProfile = z.infer<typeof SearchProfileSchema>;

export const ScoreRequestSchema = z.object({
  profile: SearchProfileSchema,
  posting: z.object({
    title: z.string().max(300).optional(),
    company: z.string().max(200).optional(),
    url: z.string().max(2000).optional(),
    location: z.string().max(300).optional(),
    description: z.string().min(40).max(60000),
  }),
  dismissals: z
    .array(z.object({ title: z.string(), company: z.string(), reason: z.string().nullable() }))
    .max(30)
    .optional()
    .describe("Roles he recently dismissed and why, so scoring learns his taste."),
});
export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export const FitSchema = z.object({
  parsed: z.object({
    title: z.string(),
    company: z.string(),
    level: z.string().describe("e.g. Director, Senior Director, Group PM, VP, Senior Manager"),
    location: z.string(),
    work_model: z.string().describe("remote, hybrid (with days if stated), or on-site"),
    comp_min: z.number().nullable().describe("Lowest posted base salary in USD, or null if not posted."),
    comp_max: z.number().nullable().describe("Highest posted base salary in USD, or null if not posted."),
    team_size: z.string().nullable().describe("Direct or indirect reports if stated, else null."),
    summary: z.string().describe("What the role owns, in one or two plain sentences."),
  }),
  fit_score: z.number().int().describe("Integer 1-10 against the anchors in the instructions."),
  verdict: z.enum(["strong", "worth_a_look", "stretch", "skip"]),
  headline: z.string().describe("One honest, constructive sentence on the fit."),
  why_you: z.array(z.string()).describe("2-4 specific reasons his background fits this role, and the angle to lead with."),
  gaps: z.array(z.string()).describe("Real gaps against the posting, each with how he could address or frame it. Empty if none."),
  checks: z.object({
    level: z.enum(["match", "above", "below", "unclear"]),
    comp: z.enum(["above_good", "between_floors", "below_ideal", "not_posted"]),
    location: z.enum(["ok", "not_ok", "unclear"]),
    domain: z.enum(["core", "adjacent", "outside"]),
  }),
  deal_breakers_hit: z.array(z.string()).describe("Any of his deal breakers this posting triggers. Empty if none."),
});
export type Fit = z.infer<typeof FitSchema>;

export type ScoreResponse = { fit: Fit; model: string; usage: { input_tokens: number; output_tokens: number } };

/** Posting found by a watchlist scan, before scoring. */
export type ScannedJob = {
  external_id: string;
  title: string;
  url: string | null;
  location: string | null;
  posted_at: string | null;
  description: string | null;
  comp_min: number | null;
  comp_max: number | null;
};

export type AtsKind = "greenhouse" | "lever" | "ashby" | "workday";
export type AtsConfig = { slug?: string; host?: string; tenant?: string; site?: string };

export const ScanRequestSchema = z.object({
  companies: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        ats: z.enum(["greenhouse", "lever", "ashby", "workday"]),
        ats_config: z.object({ slug: z.string().optional(), host: z.string().optional(), tenant: z.string().optional(), site: z.string().optional() }),
      }),
    )
    .max(40),
  titleKeywords: z.array(z.string()).max(30).optional(),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;
export type ScanResponse = { results: { company_id: string; jobs: ScannedJob[]; scanned: number; error?: string }[] };

/** Reads a public careers URL and works out which job board it is. */
export function detectAts(rawUrl: string): { ats: AtsKind; ats_config: AtsConfig } | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  if (host.endsWith("greenhouse.io")) {
    const slug = u.searchParams.get("for") ?? (host.startsWith("boards-api") ? seg[2] : seg[0]);
    return slug ? { ats: "greenhouse", ats_config: { slug } } : null;
  }
  if (host === "jobs.lever.co" || host === "api.lever.co") {
    const slug = host === "api.lever.co" ? seg[2] : seg[0];
    return slug ? { ats: "lever", ats_config: { slug } } : null;
  }
  if (host === "jobs.ashbyhq.com") return seg[0] ? { ats: "ashby", ats_config: { slug: seg[0] } } : null;
  if (host.endsWith("myworkdayjobs.com")) {
    const tenant = host.split(".")[0];
    // https://{tenant}.wd5.myworkdayjobs.com/en-US/{site}/... or /{site}
    const parts = seg[0] && /^[a-z]{2}-[A-Z]{2}$/.test(seg[0]) ? seg.slice(1) : seg;
    const site = parts[0] === "wday" ? parts[3] : parts[0];
    return site ? { ats: "workday", ats_config: { host, tenant, site } } : null;
  }
  return null;
}

/** Default title filter for scans: product leadership roles. */
export const DEFAULT_TITLE_KEYWORDS = ["product"];
const SENIORITY = /\b(director|head of|vice president|vp|group product manager|gpm|senior director|sr\.? director|principal)\b/i;
const EXCLUDE = /\b(product marketing|product design|designer|engineer|engineering manager|counsel|sales|intern)\b/i;

export function isProductLeadershipTitle(title: string, keywords = DEFAULT_TITLE_KEYWORDS): boolean {
  const t = title.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase())) && SENIORITY.test(title) && !EXCLUDE.test(title);
}
