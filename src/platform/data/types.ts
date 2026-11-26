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
