import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import PostalMime from "postal-mime";
import { z } from "zod";
import { json } from "../server/http.js";

export const config = { maxDuration: 120 };

const MODEL = "claude-opus-5-5";

const AlertSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      url: z.string().nullable().describe("The job's own link from the email, exactly as written, or null."),
      job_id: z.string().nullable().describe("The site's job id if visible in the link (e.g. the number in /jobs/view/123), else null."),
      snippet: z.string().nullable().describe("Any salary, work model or description text the email shows for this job, else null."),
    }),
  ),
});

/**
 * Receives job alert emails forwarded by the Cloudflare Email Worker (workers/email-ingest.js),
 * extracts each job with Claude, and adds new ones to the Discover inbox as unscored matches.
 * Auth: shared secret header. Writes with the service role for the single user named in ALLOWED_EMAILS.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.headers.get("x-ingest-secret") !== secret) return json(401, { error: "Bad ingest secret." });

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const owner = (process.env.ALLOWED_EMAILS ?? "").split(",")[0]?.trim().toLowerCase();
  if (!url || !serviceKey || !owner || !process.env.ANTHROPIC_API_KEY) return json(500, { error: "Ingest env vars are not set." });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: users, error: userErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (userErr) return json(500, { error: userErr.message });
  const user = users.users.find((u) => u.email?.toLowerCase() === owner);
  if (!user) return json(500, { error: "Owner account not found. Sign in to the app once first." });

  const email = await PostalMime.parse(await request.text());
  const body = (email.text || email.html?.replace(/<[^>]+>/g, " ") || "").replace(/\s+\n/g, "\n").slice(0, 80000);
  const log = { user_id: user.id, sender: email.from?.address ?? request.headers.get("x-mail-from"), subject: email.subject ?? null };

  try {
    const res = await new Anthropic().beta.messages.parse({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(AlertSchema) },
      system:
        "Extract every job posting listed in this job alert email. Ignore ads, 'people also viewed', and navigation links. If the email is not a job alert (for example a forwarding confirmation), return an empty list.",
      messages: [{ role: "user", content: `Subject: ${email.subject ?? ""}\n\n${body}` }],
    });
    const jobs = res.parsed_output?.jobs ?? [];
    const rows = jobs.map((j) => ({
      user_id: user.id,
      company_name: j.company,
      source: "email_alert",
      external_id: j.job_id ?? j.url ?? `${j.company}|${j.title}`.toLowerCase(),
      title: j.title,
      url: j.url,
      location: j.location,
      description: j.snippet,
      status: "new",
    }));
    let added = 0;
    if (rows.length) {
      const { data, error } = await db.from("job_matches").upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true }).select("id");
      if (error) throw new Error(error.message);
      added = data?.length ?? 0;
    }
    // Keep a short excerpt of non-alert mail (e.g. Gmail's forwarding confirmation code) so it can be read in the app.
    await db.from("inbound_emails").insert({ ...log, parsed_count: added, error: jobs.length ? null : body.slice(0, 600) });
    return json(200, { found: jobs.length, added });
  } catch (err) {
    await db.from("inbound_emails").insert({ ...log, error: (err as Error).message });
    return json(500, { error: (err as Error).message });
  }
}
