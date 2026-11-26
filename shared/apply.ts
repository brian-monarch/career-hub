import { z } from "zod";

export const TailorRequestSchema = z.object({
  kind: z.enum(["resume", "cover_letter"]),
  baseResume: z.string().min(200).max(40000),
  posting: z.object({
    company: z.string().max(200),
    title: z.string().max(300),
    description: z.string().max(60000).nullish(),
    fitNotes: z.string().max(4000).nullish(),
  }),
  headline: z.string().max(2000).nullish(),
  instructions: z.string().max(2000).nullish(),
});
export type TailorRequest = z.infer<typeof TailorRequestSchema>;

export const TailoredResumeSchema = z.object({
  resume: z
    .string()
    .describe("The full tailored resume in Markdown: name and contact lines unchanged, then summary, experience, and the rest. Same facts as the base resume."),
  changes: z.array(z.string()).describe("3-8 short notes on what changed and why, so he can review quickly."),
  keywords_covered: z.array(z.string()).describe("Important terms from the posting the resume now reflects truthfully."),
  keywords_missing: z
    .array(z.string())
    .describe("Important terms from the posting that the base resume gives no honest basis for. He decides whether he has real experience to add."),
  questions: z.array(z.string()).describe("Up to 3 questions where a real number or detail from him would make the resume stronger. Empty if none."),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const CoverLetterSchema = z.object({
  letter: z.string().describe("The cover letter in plain paragraphs, 250-350 words, ready to paste. No placeholders except [Hiring Manager] when no name is known."),
  angle: z.string().describe("One sentence: the angle the letter takes and why it suits this role."),
  questions: z.array(z.string()).describe("Up to 3 facts he should confirm or add before sending. Empty if none."),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export type TailorResponse =
  | { kind: "resume"; result: TailoredResume; model: string }
  | { kind: "cover_letter"; result: CoverLetter; model: string };
