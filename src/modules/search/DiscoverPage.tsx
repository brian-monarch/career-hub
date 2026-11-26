import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/platform/data/supabase";
import type { Fit } from "@shared/jobs";
import { Button } from "@/platform/ui/Button";
import { Card, Empty, Label, PageHeader } from "@/platform/ui/primitives";
import type { JobMatch } from "@/platform/data/types";
import {
  addPastedPosting,
  profileComplete,
  profileForApi,
  scanWatchlist,
  useCompanies,
  useDismissMatch,
  useMatches,
  useProfile,
  usePromoteMatch,
  useRescore,
  useRestoreMatch,
  type ScanProgress,
} from "./data";
import { FitBadge, FitDetail, formatComp } from "./FitDetail";

const DISMISS_REASONS = ["Level", "Comp", "Location", "Domain", "Company", "Not interested"];

export function DiscoverPage() {
  const qc = useQueryClient();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: companies = [] } = useCompanies();
  const { data: matches = [], isLoading } = useMatches();
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState("");
  const [showLower, setShowLower] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const scannable = companies.filter((c) => c.watchlist && c.ats && c.ats !== "other").length;
  const ready = profileComplete(profile);

  async function runScan() {
    if (!ready) return;
    setScanError("");
    try {
      await scanWatchlist(companies, profileForApi(profile), (p) => {
        setScan(p);
        qc.invalidateQueries({ queryKey: ["job_matches"] });
      });
    } catch (e) {
      setScanError((e as Error).message);
      setScan(null);
    }
    qc.invalidateQueries({ queryKey: ["companies"] });
  }

  const inbox = matches.filter((m) => m.status === "new");
  const strong = inbox.filter((m) => (m.fit_score ?? 0) >= 6);
  const unscored = inbox.filter((m) => m.fit_score == null);
  const lower = inbox.filter((m) => m.fit_score != null && m.fit_score < 6);
  const dismissed = matches.filter((m) => m.status === "dismissed");

  if (loadingProfile) return null;

  return (
    <>
      <PageHeader eyebrow="Search" title="Discover">
        <Button onClick={runScan} disabled={!ready || !scannable || (scan != null && scan.phase !== "done")}>
          {scan && scan.phase === "scanning" ? "Scanning…" : scan && scan.phase === "scoring" ? `Scoring ${scan.scored}/${scan.found}…` : "Scan watchlist"}
        </Button>
      </PageHeader>

      {!ready && (
        <Card className="mb-6 border-brass-300/40">
          <p className="text-stone-200">Set your search preferences first.</p>
          <p className="mt-1 text-sm text-stone-400">
            Fit scores are judged against your titles, level, locations and comp floors.{" "}
            <Link to="/preferences" className="text-brass-300 underline-offset-2 hover:underline">Open preferences</Link>
          </p>
        </Card>
      )}
      {ready && !scannable && (
        <p className="mb-6 text-sm text-stone-400">
          No scannable companies yet. Add careers pages on the <Link to="/watchlist" className="text-brass-300 hover:underline">watchlist</Link>, or paste a posting below.
        </p>
      )}
      {scan?.phase === "done" && (
        <p className="mb-4 text-sm text-stone-400">
          Scan finished: {scan.found} new {scan.found === 1 ? "role" : "roles"} found.
          {scan.errors.length > 0 && <span className="text-terracotta-300"> {scan.errors.join(" · ")}</span>}
        </p>
      )}
      {scanError && <p className="mb-4 text-sm text-terracotta-300">{scanError}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {isLoading ? null : inbox.length === 0 ? (
            <Empty title="Inbox is empty">Scan your watchlist or paste a posting. New roles land here with a fit score.</Empty>
          ) : (
            <>
              {strong.length > 0 && <Section title={`Worth your time · ${strong.length}`} items={strong} />}
              {unscored.length > 0 && <Section title={`Waiting for a score · ${unscored.length}`} items={unscored} />}
              {lower.length > 0 && (
                <div>
                  <button className="eyebrow cursor-pointer hover:text-stone-200" onClick={() => setShowLower((v) => !v)}>
                    {showLower ? "−" : "+"} {lower.length} lower-fit {lower.length === 1 ? "role" : "roles"}
                  </button>
                  <p className="mt-1 text-xs text-stone-500">Scored under 6 against your preferences. That's about the role, not about you.</p>
                  {showLower && <div className="mt-3 space-y-3">{lower.map((m) => <MatchCard key={m.id} match={m} />)}</div>}
                </div>
              )}
            </>
          )}
          {dismissed.length > 0 && (
            <div>
              <button className="eyebrow cursor-pointer hover:text-stone-200" onClick={() => setShowDismissed((v) => !v)}>
                {showDismissed ? "−" : "+"} {dismissed.length} dismissed
              </button>
              {showDismissed && <div className="mt-3 space-y-3">{dismissed.map((m) => <MatchCard key={m.id} match={m} />)}</div>}
            </div>
          )}
        </div>
        <div className="space-y-6">
          <PasteCard disabled={!ready} />
          <EmailIntake />
        </div>
      </div>
    </>
  );
}

function Section({ title, items }: { title: string; items: JobMatch[] }) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <div className="space-y-3">{items.map((m) => <MatchCard key={m.id} match={m} />)}</div>
    </div>
  );
}

function MatchCard({ match: m }: { match: JobMatch }) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const promote = usePromoteMatch();
  const dismiss = useDismissMatch();
  const restore = useRestoreMatch();
  const rescore = useRescore();
  const { data: profile } = useProfile();
  const fit = m.fit_detail as Fit | null;
  const comp = formatComp(m.comp_min, m.comp_max);

  return (
    <div className={`card p-4 transition-shadow duration-150 hover:shadow-deep ${m.status === "dismissed" ? "opacity-60" : ""}`}>
      <div className="flex gap-4">
        <FitBadge score={m.fit_score} />
        <div className="min-w-0 flex-1">
          <button onClick={() => setOpen((v) => !v)} className="block w-full cursor-pointer text-left">
            <p className="font-medium text-stone-100">{m.title}</p>
            <p className="mt-0.5 text-sm text-stone-400">
              {m.company_name}
              {m.location && ` · ${m.location}`}
              {comp && <span className="font-mono"> · {comp}</span>}
            </p>
            {m.fit_summary && <p className="mt-2 text-sm text-stone-300">{m.fit_summary}</p>}
          </button>
          {open && fit && (
            <div className="mt-4 animate-fade">
              <FitDetail fit={fit} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {m.status === "new" && (
              <>
                <Button className="px-3 py-1.5 text-xs" onClick={() => promote.mutate(m)} disabled={promote.isPending}>
                  {promote.isPending ? "Adding…" : "Add to pipeline"}
                </Button>
                {dismissing ? (
                  DISMISS_REASONS.map((r) => (
                    <Button key={r} variant="secondary" className="px-2 py-1 text-xs" onClick={() => dismiss.mutate({ id: m.id, reason: r })}>
                      {r}
                    </Button>
                  ))
                ) : (
                  <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setDismissing(true)}>Dismiss</Button>
                )}
              </>
            )}
            {m.status === "dismissed" && (
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => restore.mutate(m.id)}>
                Restore{m.dismiss_reason && ` (dismissed: ${m.dismiss_reason})`}
              </Button>
            )}
            {m.fit_score == null && (m.description?.length ?? 0) < 40 && (
              <span className="text-xs text-stone-500">No description came through for this one. Open the posting, then paste its description on the right to score it.</span>
            )}
            {m.fit_score == null && profile && (m.description?.length ?? 0) >= 40 && (
              <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={rescore.isPending} onClick={() => rescore.mutate({ profile: profileForApi(profile), match: m })}>
                {rescore.isPending ? "Scoring…" : "Score"}
              </Button>
            )}
            {m.url && (
              <a href={m.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-stone-400 hover:text-stone-200">
                Open posting ↗
              </a>
            )}
          </div>
          {(promote.error || rescore.error) && (
            <p className="mt-2 text-xs text-terracotta-300">{((promote.error || rescore.error) as Error).message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PasteCard({ disabled }: { disabled: boolean }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "scoring" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setStatus("scoring");
    setError("");
    try {
      await addPastedPosting(profileForApi(profile), { url, text });
      setUrl("");
      setText("");
      setStatus("idle");
      qc.invalidateQueries({ queryKey: ["job_matches"] });
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <Card className="h-fit">
      <form onSubmit={submit} className="space-y-3">
        <p className="font-medium text-stone-100">Paste a posting</p>
        <p className="text-xs text-stone-500">From a LinkedIn alert, a recruiter email, anywhere. Copy the whole job description.</p>
        <div>
          <Label htmlFor="purl">Link (optional)</Label>
          <input id="purl" className="field text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <Label htmlFor="ptext">Job description</Label>
          <textarea id="ptext" className="field text-sm" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={disabled || status === "scoring" || text.trim().length < 40}>
          {status === "scoring" ? "Scoring…" : "Score and add"}
        </Button>
        {status === "error" && <p className="text-xs text-terracotta-300">{error}</p>}
      </form>
    </Card>
  );
}

function EmailIntake() {
  const { data = [] } = useQuery({
    queryKey: ["inbound_emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inbound_emails").select("*").order("received_at", { ascending: false }).limit(5);
      if (error) return [];
      return data as { id: string; received_at: string; subject: string | null; parsed_count: number; error: string | null }[];
    },
  });
  if (!data.length) return null;
  return (
    <Card>
      <p className="eyebrow">Email alerts received</p>
      <ul className="mt-3 space-y-3 text-xs">
        {data.map((e) => (
          <li key={e.id}>
            <p className="text-stone-300">{e.subject ?? "(no subject)"}</p>
            <p className="text-stone-500">
              {new Date(e.received_at).toLocaleString()} · {e.parsed_count} new
            </p>
            {e.error && <p className="mt-1 whitespace-pre-line break-words text-stone-400">{e.error.slice(0, 400)}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
