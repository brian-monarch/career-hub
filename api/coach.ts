import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import {
  CoachRequestSchema,
  FeedbackSchema,
  PERSONAS,
  RUBRIC,
  overallScore,
  type CoachRequest,
  type CoachResponse,
} from "../shared/coach.js";

export const config = { maxDuration: 60 };

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are an interview coach for a senior product leader preparing for Director of Product interviews in data platforms, measurement, ad-tech and retail media.

Your job is to make each answer measurably better, not to make the candidate feel good. Be direct and specific. No praise padding, no corporate jargon.

Grade each rubric dimension 1-5 against its anchor. A 3 is an ordinary answer; reserve 5 for an answer a demanding hiring manager would repeat to the debrief panel.

${RUBRIC.map((r) => `- ${r.key}: ${r.anchor}`).join("\n")}

Known habits to hunt for in this candidate:
- Says "we" when the decision was his own, which hides his judgement. Flag every instance where the context shows he made the call.
- Describes the work and the system but stops before the business outcome or the number.
- Undersells his point of view: the answer should state what he believed and why, early.

Rules:
- Never invent facts, numbers, names or outcomes. When a number is missing, write [number] in the rewrite and name it in missing_proof.
- If a story from his story bank is provided, ground the feedback in it: point out proof points from the story he left out.
- The probe must be the single follow-up this interviewer would most likely ask, aimed at the weakest point.
- The answer may be a speech-to-text transcript; ignore transcription errors and punctuation.`;

function buildPrompt(req: CoachRequest): string {
  const persona = PERSONAS[req.persona];
  const parts: string[] = [
    `<interviewer>${persona.label}: ${persona.brief}</interviewer>`,
    `<question>${req.question}</question>`,
    `<answer>${req.answer}</answer>`,
  ];
  if (req.delivery) {
    const d = req.delivery;
    parts.push(
      `<delivery>words: ${d.wordCount ?? "?"}; duration: ${d.durationS ?? "?"}s; pace: ${d.wordsPerMin ?? "?"} wpm; filler words: ${d.fillerCount ?? "?"}; "we/our/us": ${d.weCount ?? "?"}; "I/my/me": ${d.iCount ?? "?"}</delivery>`,
    );
  }
  if (req.story) {
    const s = req.story;
    parts.push(
      `<story_he_chose title="${s.title}">\nSituation: ${s.situation ?? ""}\nTask: ${s.task ?? ""}\nAction: ${s.action ?? ""}\nResult: ${s.result ?? ""}\nMetrics: ${s.metrics ?? ""}\nThe decision he personally made: ${s.my_decision ?? ""}\n</story_he_chose>`,
    );
  }
  if (req.storyTitles?.length) parts.push(`<other_stories_in_bank>${req.storyTitles.join("; ")}</other_stories_in_bank>`);
  if (req.targetRole) parts.push(`<target_role>${req.targetRole}</target_role>`);
  if (req.previous?.length) {
    parts.push(
      `<earlier_in_session>\n${req.previous.map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer}`).join("\n\n")}\n</earlier_in_session>`,
    );
  }
  return parts.join("\n\n");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return json(500, { error: "Supabase env vars are not set on this deploy." });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY is not set on this deploy." });

  // Only a signed-in user (and, if ALLOWED_EMAILS is set, only those emails) can spend API credits.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in." });
  const { data: userData, error: authError } = await createClient(supabaseUrl, supabaseKey).auth.getUser(token);
  if (authError || !userData.user) return json(401, { error: "Session expired. Sign in again." });
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((userData.user.email ?? "").toLowerCase())) {
    return json(403, { error: "This account is not allowed to use the coach." });
  }

  const parsed = CoachRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Bad request", issues: parsed.error.issues });

  const client = new Anthropic();
  try {
    // Server-side fallback: if a safety classifier declines, the API re-runs the request on a fallback model.
    const response = await client.beta.messages.parse({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(FeedbackSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(parsed.data) }],
    });

    if (response.stop_reason === "refusal") return json(502, { error: "The coach declined to score this answer. Try rephrasing." });
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return json(502, { error: "The coach's response was incomplete. Try again." });
    }

    const feedback = response.parsed_output;
    const body: CoachResponse = {
      feedback,
      overall: overallScore(feedback),
      model: response.model,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    };
    return json(200, body);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "Rate limited by the Claude API. Wait a minute and retry." });
    if (err instanceof Anthropic.AuthenticationError) return json(500, { error: "ANTHROPIC_API_KEY is invalid." });
    if (err instanceof Anthropic.APIError) return json(502, { error: `Claude API error (${err.status ?? "network"}).` });
    throw err;
  }
}
