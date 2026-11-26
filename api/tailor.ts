import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CoverLetterSchema, TailorRequestSchema, TailoredResumeSchema, type TailorRequest, type TailorResponse } from "../shared/apply.js";
import { claudeErrorResponse, json, requireUser } from "../server/http.js";

export const config = { maxDuration: 300 };

const MODEL = "claude-opus-5-5";

const SHARED_RULES = `You write application materials for a senior product leader applying to Director-level product roles.

Non-negotiable:
- Use only facts in his base resume and notes. Never invent employers, titles, dates, numbers, tools or outcomes. Rewording, reordering, and choosing emphasis are fine; adding claims is not.
- Where he facilitated rather than decided, say so accurately ("led delivery of", "drove alignment across"), never "owned the decision".
- Plain, specific language. No buzzwords: avoid "results-driven", "passionate", "synergy", "leverage" as a verb, "spearheaded", "dynamic".
- Write in his voice: direct, concrete, first person in letters, implied first person in resume bullets.`;

const RESUME_TASK = `Tailor the base resume to this posting.
- Rewrite the summary (3 lines max) to lead with what this role needs most that he has done.
- In each role, reorder bullets so the most relevant come first; tighten wording to mirror the posting's language where it is truthful. You may drop weak, irrelevant bullets from older roles.
- Keep every role, title and date exactly. Keep it to two pages of content.
- Return the whole resume in clean Markdown (# name, contact line, ## sections, ### role headers, - bullets).`;

const LETTER_TASK = `Write a cover letter for this posting.
- Open with why this role at this company, in one or two specific sentences (from the posting, not generic praise).
- Middle: two short proof paragraphs, each tying one requirement of the role to something specific he did, with the number where the resume has one.
- Close with one sentence on what he would focus on first and a plain sign-off.
- 250-350 words. No "I am writing to apply". No restating the whole resume.`;

function buildPrompt(r: TailorRequest): string {
  return [
    `<base_resume>\n${r.baseResume}\n</base_resume>`,
    r.headline ? `<about_him>\n${r.headline}\n</about_him>` : "",
    `<posting company="${r.posting.company}" title="${r.posting.title}">\n${r.posting.description ?? "(no description saved; work from the title)"}\n</posting>`,
    r.posting.fitNotes ? `<fit_assessment>\n${r.posting.fitNotes}\n</fit_assessment>` : "",
    r.instructions ? `<his_instructions>\n${r.instructions}\n</his_instructions>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser(request, { needsClaude: true });
  if (user instanceof Response) return user;

  const parsed = TailorRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Bad request", issues: parsed.error.issues });
  const req = parsed.data;

  const client = new Anthropic();
  const common = {
    model: MODEL,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    max_tokens: 32000,
    messages: [{ role: "user" as const, content: buildPrompt(req) }],
  };

  try {
    let body: TailorResponse;
    if (req.kind === "resume") {
      const stream = client.beta.messages.stream({
        ...common,
        system: `${SHARED_RULES}\n\n${RESUME_TASK}`,
        output_config: { effort: "medium", format: betaZodOutputFormat(TailoredResumeSchema) },
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") return json(502, { error: "Claude declined this request." });
      const result = TailoredResumeSchema.safeParse(JSON.parse(textOf(msg.content)));
      if (!result.success) return json(502, { error: "The tailored resume came back incomplete. Try again." });
      body = { kind: "resume", result: result.data, model: msg.model };
    } else {
      const stream = client.beta.messages.stream({
        ...common,
        system: `${SHARED_RULES}\n\n${LETTER_TASK}`,
        output_config: { effort: "medium", format: betaZodOutputFormat(CoverLetterSchema) },
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") return json(502, { error: "Claude declined this request." });
      const result = CoverLetterSchema.safeParse(JSON.parse(textOf(msg.content)));
      if (!result.success) return json(502, { error: "The cover letter came back incomplete. Try again." });
      body = { kind: "cover_letter", result: result.data, model: msg.model };
    }
    return json(200, body);
  } catch (err) {
    if (err instanceof SyntaxError) return json(502, { error: "The response was cut off. Try again." });
    return claudeErrorResponse(err);
  }
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
