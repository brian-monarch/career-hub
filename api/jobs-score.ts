import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FitSchema, ScoreRequestSchema, type ScoreRequest, type ScoreResponse } from "../shared/jobs.js";
import { claudeErrorResponse, json, requireUser } from "../server/http.js";

export const config = { maxDuration: 60 };

const MODEL = "claude-opus-5-5";

const SYSTEM = `You assess job postings for one senior product leader's search. Your output decides what he spends time on, so it must be accurate, not flattering and not discouraging.

Score fit 1-10 with these anchors:
- 9-10: the role he is targeting, at his level, in his core domain, location and comp work. Apply this week.
- 7-8: strong fit with one real question (comp not posted, adjacent domain, level slightly off). Worth pursuing.
- 5-6: a stretch or a sideways move; pursue only with a specific reason.
- 1-4: wrong level, wrong function, or a deal breaker.

Rules:
- His domains are preferences, not requirements. A role outside them can still score 7+ when the company matches his boosts (for example well respected, local, tech-oriented, or in an industry he cares about) and he is qualified for the role.
- Judge against his profile, not against an ideal candidate. A posting asking for things he lacks is a gap to frame, not a reason for a low score, unless it is core to the role.
- A low score is about the role's fit, never about his worth. Phrase gaps as what to address or how to position, in plain language.
- Comp: compare total compensation to his floors (base plus typical bonus at that level if only base is posted). If no pay is posted, say so; do not guess a number.
- Location: respect his locations and remote preference. Hybrid in a listed metro is fine; on-site elsewhere is not.
- Never invent facts about the company or role that are not in the posting.
- Extract the posting fields exactly as written. Use null where something is not stated.`;

function money(n: number | null | undefined) {
  return n ? `$${Math.round(n / 1000)}k` : "not set";
}

function buildPrompt({ profile: p, posting }: ScoreRequest): string {
  const profile = [
    p.headline ?? "",
    `Target titles: ${p.target_titles.join(", ") || "not set"}`,
    `Target levels: ${p.target_levels.join(", ") || "not set"}`,
    `Domains: ${p.domains.join(", ") || "not set"}`,
    `Locations: ${p.locations.join(", ") || "not set"}; remote ${p.remote_ok ? "welcome" : "not wanted"}; max travel ${p.max_travel_pct ?? "?"}%`,
    `Comp: will take ${money(p.comp_floor_ideal)} total for an ideal role; needs ${money(p.comp_floor_good)} total for a good-but-not-ideal role`,
    `Must haves: ${p.must_haves ?? "none listed"}`,
    `Deal breakers: ${p.deal_breakers ?? "none listed"}`,
    `Boosts (raise interest even outside his domains): ${p.boosts ?? "none listed"}`,
  ].join("\n");
  const header = [
    posting.company && `Company: ${posting.company}`,
    posting.title && `Title: ${posting.title}`,
    posting.location && `Location: ${posting.location}`,
    posting.url && `URL: ${posting.url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `<candidate_profile>\n${profile}\n</candidate_profile>\n\n<posting>\n${header}\n\n${posting.description}\n</posting>`;
}

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser(request, { needsClaude: true });
  if (user instanceof Response) return user;

  const parsed = ScoreRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Bad request", issues: parsed.error.issues });

  try {
    const response = await new Anthropic().beta.messages.parse({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(FitSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(parsed.data) }],
    });
    if (response.stop_reason === "refusal") return json(502, { error: "Claude declined to score this posting." });
    if (!response.parsed_output) return json(502, { error: "The fit score came back incomplete. Try again." });
    const body: ScoreResponse = {
      fit: response.parsed_output,
      model: response.model,
      usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    };
    return json(200, body);
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
