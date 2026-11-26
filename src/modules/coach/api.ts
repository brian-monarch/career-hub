import { supabase } from "@/platform/data/supabase";
import { callApi } from "@/platform/data/api";
import type { CoachRequest, CoachResponse } from "@shared/coach";

export const requestFeedback = (body: CoachRequest) => callApi<CoachResponse>("/api/coach", body);

/** Persist a scored take. Session row is created lazily on the first take. */
export async function saveTake(args: {
  sessionId: string | null;
  persona: string;
  question: string;
  isProbe: boolean;
  storyId: string | null;
  transcript: string;
  stats: { durationS: number | null; wordsPerMin: number | null; fillerCount: number; weCount: number; iCount: number };
  result: CoachResponse;
}): Promise<{ sessionId: string; takeId: string }> {
  let sessionId = args.sessionId;
  if (!sessionId) {
    const { data, error } = await supabase.from("practice_sessions").insert({ mode: "mock", persona: args.persona }).select("id").single();
    if (error) throw new Error(error.message);
    sessionId = data.id as string;
  }
  const { data: take, error: takeErr } = await supabase
    .from("takes")
    .insert({
      session_id: sessionId,
      question_text: args.question,
      is_probe: args.isProbe,
      story_id: args.storyId,
      transcript: args.transcript,
      duration_s: args.stats.durationS,
      words_per_min: args.stats.wordsPerMin,
      filler_count: args.stats.fillerCount,
      we_count: args.stats.weCount,
      i_count: args.stats.iCount,
    })
    .select("id")
    .single();
  if (takeErr) throw new Error(takeErr.message);

  const s = args.result.feedback.scores;
  const { error: fbErr } = await supabase.from("feedback").insert({
    take_id: take.id,
    overall: args.result.overall,
    score_structure: s.structure.score,
    score_specificity: s.specificity.score,
    score_impact: s.impact.score,
    score_ownership: s.ownership.score,
    score_relevance: s.relevance.score,
    score_length: s.length.score,
    detail: args.result.feedback,
    model: args.result.model,
    input_tokens: args.result.usage.input_tokens,
    output_tokens: args.result.usage.output_tokens,
  });
  if (fbErr) throw new Error(fbErr.message);
  return { sessionId, takeId: take.id as string };
}
