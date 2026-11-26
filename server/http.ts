import Anthropic from "@anthropic-ai/sdk";
import { createClient, type User } from "@supabase/supabase-js";

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Verifies the caller's Supabase session (and ALLOWED_EMAILS when set).
 * Returns the user, or a Response to send back as-is.
 */
export async function requireUser(request: Request, opts: { needsClaude?: boolean } = {}): Promise<User | Response> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return json(500, { error: "Supabase env vars are not set on this deploy." });
  if (opts.needsClaude && !process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY is not set on this deploy." });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Not signed in." });
  const { data, error } = await createClient(supabaseUrl, supabaseKey).auth.getUser(token);
  if (error || !data.user) return json(401, { error: "Session expired. Sign in again." });

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((data.user.email ?? "").toLowerCase())) {
    return json(403, { error: "This account is not allowed to use Career Hub's AI features." });
  }
  return data.user;
}

/** Maps Claude API errors to a response the app can show. Rethrows anything else. */
export function claudeErrorResponse(err: unknown): Response {
  if (err instanceof Anthropic.RateLimitError) return json(429, { error: "Rate limited by the Claude API. Wait a minute and retry." });
  if (err instanceof Anthropic.AuthenticationError) return json(500, { error: "ANTHROPIC_API_KEY is invalid." });
  if (err instanceof Anthropic.APIError) return json(502, { error: `Claude API error (${err.status ?? "network"}).` });
  throw err;
}
