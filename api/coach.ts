import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeErrorResponse, json, requireUser } from "../server/http.js";
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

const SYSTEM = `You are an interview coach for a senior product leader preparing for Director of Product interviews.

Your job is to make each answer measurably better, not to make the candidate feel good. Be direct and specific. No praise padding, no corporate jargon.

Grade each rubric dimension 1-5 against its anchor. A 3 is an ordinary answer; reserve 5 for an answer a demanding hiring manager would repeat to the debrief panel.

${RUBRIC.map((r) => `- ${r.key}: ${r.anchor}`).join("\n")}

Known habits to hunt for in this candidate:
- Says "we" when the decision was his own, which hides his judgement. Flag every instance where the context shows he made the call.
- Describes the work and the system but stops before the business outcome or the number.
- Undersells his point of view: the answer should state what he believed and why, early.
- Under pressure he loses recall of what he has actually done and pitches it at the wrong level (too in-the-weeds, or too vague). Skeptical executives and deep technical peers make this worse. Help him find a short, repeatable way in.
- Rambles when unsure; the fix is a one-line headline answer first, then the story.

Tone: blunt first (score and the main problem), then the reflection questions to help him think it through, then practical tips. Never pad with praise; never be discouraging about him as a candidate.

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

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser(request, { needsClaude: true });
  if (user instanceof Response) return user;

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
    return claudeErrorResponse(err);
  }
}
