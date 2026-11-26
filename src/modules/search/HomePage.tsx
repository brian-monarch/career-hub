import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/platform/data/supabase";
import { Card, PageHeader } from "@/platform/ui/primitives";
import { useMatches, usePostings } from "./data";
import { FitBadge } from "./FitDetail";

type StageEvent = { posting_id: string; from_stage: string | null; to_stage: string; at: string };

const WEEK = 7 * 86_400_000;
const ADVANCE: Record<string, string> = {
  networking: "Started networking",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
};

function useWeekEvents() {
  return useQuery({
    queryKey: ["stage_events", "week"],
    queryFn: async () => {
      const since = new Date(Date.now() - WEEK).toISOString();
      const { data, error } = await supabase.from("stage_events").select("posting_id, from_stage, to_stage, at").gte("at", since).order("at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as StageEvent[];
    },
  });
}

/** Home: what moved this week. Built for momentum, so misses are not counted here. */
export function HomePage() {
  const { data: matches = [] } = useMatches();
  const { data: postings = [] } = usePostings();
  const { data: events = [] } = useWeekEvents();

  const weekAgo = Date.now() - WEEK;
  const newGood = matches.filter((m) => m.status === "new" && (m.fit_score ?? 0) >= 6 && new Date(m.found_at).getTime() > weekAgo);
  const moves = events.filter((e) => e.from_stage && ADVANCE[e.to_stage]);
  const active = postings.filter((p) => ["identified", "networking", "applied", "interviewing", "offer"].includes(p.stage));
  const stale = active.filter((p) => Date.now() - new Date(p.stage_changed_at).getTime() > 10 * 86_400_000 && p.stage !== "offer");
  const interviewing = active.filter((p) => p.stage === "interviewing");
  const name = (id: string) => {
    const p = postings.find((x) => x.id === id);
    return p ? `${p.companies?.name ?? ""} · ${p.title}` : "A role";
  };

  return (
    <>
      <PageHeader eyebrow="This week" title="What moved" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="New roles worth a look" value={newGood.length} to="/discover" />
        <Stat label="Steps forward" value={moves.length} to="/pipeline" />
        <Stat label="Active roles" value={active.length} to="/pipeline" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="eyebrow">Progress this week</p>
          {moves.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No stage moves yet this week. One outreach or one application gets it going.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {moves.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-sage-300">{ADVANCE[e.to_stage]}</span>
                  <span className="truncate text-stone-300">{name(e.posting_id)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="eyebrow">Best new matches</p>
          {newGood.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">
              Nothing new yet. <Link to="/discover" className="text-brass-300 hover:underline">Scan your watchlist</Link> or paste a posting.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {newGood.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <FitBadge score={m.fit_score} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-stone-100">{m.title}</p>
                    <p className="truncate text-xs text-stone-400">{m.company_name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {interviewing.length > 0 && (
          <Card>
            <p className="eyebrow">Interviewing</p>
            <ul className="mt-3 space-y-2 text-sm text-stone-200">
              {interviewing.map((p) => (
                <li key={p.id}>{p.companies?.name} · {p.title}</li>
              ))}
            </ul>
            <Link to="/coach" className="mt-3 inline-block text-sm text-brass-300 hover:underline">Practice for these →</Link>
          </Card>
        )}

        {stale.length > 0 && (
          <Card>
            <p className="eyebrow">Needs a nudge</p>
            <p className="mt-1 text-xs text-stone-500">No movement in 10+ days. A follow-up or a decision to let it go both count.</p>
            <ul className="mt-3 space-y-2 text-sm text-stone-300">
              {stale.slice(0, 6).map((p) => (
                <li key={p.id}>{p.companies?.name} · {p.title}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="card p-5 transition-shadow duration-150 hover:shadow-deep">
      <p className="font-mono text-3xl font-semibold text-stone-100">{value}</p>
      <p className="mt-1 text-sm text-stone-400">{label}</p>
    </Link>
  );
}
