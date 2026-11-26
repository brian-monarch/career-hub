import { z } from "zod";

/** Rubric dimensions, in display order. Anchors are what the coach grades against. */
export const RUBRIC = [
  {
    key: "structure",
    label: "Structure",
    anchor: "5 = point first, then a clean situation/action/result arc a listener can follow without effort. 1 = rambling, no clear arc, the point arrives late or never.",
  },
  {
    key: "specificity",
    label: "Specificity",
    anchor: "5 = concrete names, systems, numbers, dates and trade-offs. 1 = generic claims that could come from anyone.",
  },
  {
    key: "impact",
    label: "Quantified impact",
    anchor: "5 = a measurable business outcome tied to the work, with a baseline. 1 = activity described, no outcome or number.",
  },
  {
    key: "ownership",
    label: "Ownership",
    anchor: "5 = names the decision the candidate personally made, why, and what they gave up; 'I' where it was theirs, 'we' only for genuine team work. 1 = all 'we', the candidate's own role is invisible.",
  },
  {
    key: "relevance",
    label: "Relevance",
    anchor: "5 = answers exactly what was asked and shows why it matters for a Director-level product role. 1 = answers a different question.",
  },
  {
    key: "length",
    label: "Length",
    anchor: "5 = 90 seconds to 2.5 minutes spoken (roughly 200-375 words) with nothing to cut. 1 = under 45 seconds or over 4 minutes.",
  },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];

export const PERSONAS = {
  recruiter_screen: {
    label: "Recruiter screen",
    brief: "A fast, friendly recruiter screening for level, scope and fit. Wants crisp headlines and numbers, not depth.",
  },
  hiring_manager: {
    label: "Hiring manager",
    brief: "The VP or Director this role reports to. Probes judgement, how the candidate leads a team, and what they personally decided.",
  },
  skeptical_vp: {
    label: "Skeptical exec",
    brief: "A senior executive who assumes the candidate is overstating their role. Pushes on attribution, numbers and trade-offs.",
  },
  peer: {
    label: "Cross-functional peer",
    brief: "An engineering or data science leader. Tests technical fluency, how the candidate handles disagreement, and how decisions get made.",
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;

const dimension = z.object({
  score: z.number().int().describe("Integer 1-5 against the anchor."),
  evidence: z.string().describe("A short quote or observation from the answer that justifies the score."),
});

export const FeedbackSchema = z.object({
  headline: z.string().describe("One blunt sentence: the verdict on this answer."),
  scores: z.object({
    structure: dimension,
    specificity: dimension,
    impact: dimension,
    ownership: dimension,
    relevance: dimension,
    length: dimension,
  }),
  strengths: z.array(z.string()).describe("Up to 3 things to keep doing. Specific, not praise."),
  missing_proof: z.string().describe("The single most important proof point missing (a number, a decision, a baseline)."),
  we_to_i: z
    .array(z.object({ quote: z.string(), rewrite: z.string() }))
    .describe("Each place 'we' hid a decision the candidate made, with an 'I' rewrite. Empty if none."),
  story_fit: z.string().describe("Whether the chosen story fits this question; if a different hero story would land better, say which and why."),
  rewrite: z.string().describe("A tighter version of the answer in the candidate's voice, 200-350 words, point first, with the decision named in 'I' form. Do not invent facts or numbers: write [number] where one is missing."),
  probe: z.string().describe("The follow-up question this interviewer would ask next, digging at the weakest point."),
  reflection: z
    .array(z.string())
    .describe("2-3 short questions that help him see why this answer came out the way it did and recall what he actually did (e.g. 'What was the one decision only you could make here?')."),
  approach_tips: z
    .array(z.string())
    .describe("2-3 concrete tips for approaching this type of question next time: an opening line pattern, what to lead with, how to pitch it at Director level."),
});

export type CoachFeedback = z.infer<typeof FeedbackSchema>;

export const CoachRequestSchema = z.object({
  question: z.string().min(3).max(2000),
  answer: z.string().min(10).max(20000),
  persona: z.enum(Object.keys(PERSONAS) as [PersonaKey, ...PersonaKey[]]),
  targetRole: z.string().max(4000).optional(),
  story: z
    .object({
      title: z.string(),
      situation: z.string().nullish(),
      task: z.string().nullish(),
      action: z.string().nullish(),
      result: z.string().nullish(),
      metrics: z.string().nullish(),
      my_decision: z.string().nullish(),
    })
    .optional(),
  storyTitles: z.array(z.string()).max(50).optional(),
  delivery: z
    .object({
      durationS: z.number().nullish(),
      wordsPerMin: z.number().nullish(),
      fillerCount: z.number().nullish(),
      weCount: z.number().nullish(),
      iCount: z.number().nullish(),
      wordCount: z.number().nullish(),
    })
    .optional(),
  previous: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(6)
    .optional()
    .describe("Earlier questions and answers in this session, so a probe has context."),
});

export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export type CoachResponse = {
  feedback: CoachFeedback;
  overall: number;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export function overallScore(f: CoachFeedback): number {
  const vals = RUBRIC.map((r) => f.scores[r.key].score);
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Delivery stats computed in the browser from the transcript. */
const FILLERS = /\b(um+|uh+|erm|like,|you know|sort of|kind of|basically|actually|literally)\b/gi;

export function deliveryStats(text: string, durationS: number | null) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const fillerCount = (text.match(FILLERS) ?? []).length;
  const weCount = (text.match(/\b(we|we're|we've|we'd|our|us)\b/gi) ?? []).length;
  const iCount = (text.match(/\b(i|i'm|i've|i'd|my|me)\b/gi) ?? []).length;
  const wordsPerMin = durationS && durationS > 5 ? Math.round((wordCount / durationS) * 60) : null;
  return { wordCount, fillerCount, weCount, iCount, wordsPerMin, durationS };
}
