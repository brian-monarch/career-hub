import { ScanRequestSchema, type ScanResponse } from "../shared/jobs.js";
import { ADAPTERS } from "../server/ats.js";
import { json, requireUser } from "../server/http.js";

export const config = { maxDuration: 60 };

/** Pulls open product-leadership roles from each watchlist company's public job board. */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const parsed = ScanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Bad request", issues: parsed.error.issues });

  const results = await Promise.all(
    parsed.data.companies.map(async (c) => {
      try {
        const { scanned, jobs } = await ADAPTERS[c.ats](c.ats_config, parsed.data.titleKeywords);
        return { company_id: c.id, scanned, jobs };
      } catch (e) {
        return { company_id: c.id, scanned: 0, jobs: [], error: (e as Error).message };
      }
    }),
  );
  const body: ScanResponse = { results };
  return json(200, body);
}
