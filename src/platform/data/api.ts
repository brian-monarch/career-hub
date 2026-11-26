import { supabase } from "./supabase";

/** POST to one of the app's /api functions with the signed-in user's token. */
export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status}).`);
  return payload as T;
}
