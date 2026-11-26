export type Story = {
  id: string;
  title: string;
  pillar: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  metrics: string | null;
  my_decision: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type StoryInput = Omit<Story, "id" | "created_at" | "updated_at">;

export type Take = {
  id: string;
  session_id: string | null;
  question_text: string;
  story_id: string | null;
  is_probe: boolean;
  transcript: string;
  duration_s: number | null;
  words_per_min: number | null;
  filler_count: number | null;
  we_count: number | null;
  i_count: number | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  take_id: string;
  overall: number | null;
  score_structure: number | null;
  score_specificity: number | null;
  score_impact: number | null;
  score_ownership: number | null;
  score_relevance: number | null;
  score_length: number | null;
  detail: unknown;
  model: string | null;
  created_at: string;
};

export type TakeWithFeedback = Take & { feedback: FeedbackRow[] };

export const STAGES = ["identified", "networking", "applied", "interviewing", "offer", "rejected"] as const;
export const ARCHIVE_STAGES = ["withdrawn", "closed"] as const;
export type Stage = (typeof STAGES)[number] | (typeof ARCHIVE_STAGES)[number];

export type Company = {
  id: string;
  name: string;
  segment: string | null;
  watchlist: boolean;
  careers_url: string | null;
  ats: "greenhouse" | "lever" | "ashby" | "workday" | "other" | null;
  ats_config: { slug?: string; host?: string; tenant?: string; site?: string } | null;
  last_scanned_at: string | null;
  notes: string | null;
};

export type Posting = {
  id: string;
  company_id: string | null;
  title: string;
  level: string | null;
  url: string | null;
  comp_min: number | null;
  comp_max: number | null;
  location: string | null;
  source: string | null;
  fit_score: number | null;
  fit_rationale: string | null;
  fit_detail: unknown;
  description: string | null;
  stage: Stage;
  stage_changed_at: string;
  notes: string | null;
  created_at: string;
  companies: { name: string } | null;
};

export type JobMatch = {
  id: string;
  company_id: string | null;
  company_name: string;
  source: string;
  external_id: string | null;
  title: string;
  url: string | null;
  location: string | null;
  posted_at: string | null;
  description: string | null;
  comp_min: number | null;
  comp_max: number | null;
  fit_score: number | null;
  fit_summary: string | null;
  fit_detail: unknown;
  status: "new" | "promoted" | "dismissed";
  dismiss_reason: string | null;
  posting_id: string | null;
  found_at: string;
};

export type SearchProfileRow = {
  headline: string | null;
  target_titles: string[];
  target_levels: string[];
  domains: string[];
  locations: string[];
  remote_ok: boolean;
  max_travel_pct: number | null;
  comp_floor_ideal: number | null;
  comp_floor_good: number | null;
  must_haves: string | null;
  deal_breakers: string | null;
};
