import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Fit } from "@shared/jobs";
import { Button } from "@/platform/ui/Button";
import { Label, PageHeader } from "@/platform/ui/primitives";
import { ARCHIVE_STAGES, STAGES, type Posting, type Stage } from "@/platform/data/types";
import { useAddPosting, useMovePosting, usePostings, useUpdatePosting } from "./data";
import { FitBadge, FitDetail, formatComp } from "./FitDetail";

const STAGE_LABEL: Record<Stage, string> = {
  identified: "Identified",
  networking: "Networking",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

const daysIn = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export function PipelinePage() {
  const { data: postings = [], isLoading, error } = usePostings();
  const move = useMovePosting();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [selected, setSelected] = useState<Posting | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const archived = postings.filter((p) => (ARCHIVE_STAGES as readonly string[]).includes(p.stage));

  function drop(stage: Stage) {
    const p = postings.find((x) => x.id === dragId);
    if (p && p.stage !== stage) move.mutate({ id: p.id, stage });
    setDragId(null);
    setOverStage(null);
  }

  return (
    <>
      <PageHeader eyebrow="Search" title="Pipeline">
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add a role"}</Button>
      </PageHeader>
      {adding && <AddForm onDone={() => setAdding(false)} />}
      {error && <p className="mb-4 text-sm text-terracotta-300">{(error as Error).message}</p>}

      {!isLoading && (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          <div className="grid min-w-[1050px] grid-cols-6 gap-3">
            {STAGES.map((stage) => {
              const items = postings.filter((p) => p.stage === stage);
              return (
                <div
                  key={stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage);
                  }}
                  onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                  onDrop={() => drop(stage)}
                  className={`min-h-[60vh] rounded-lg border p-2 transition-colors duration-150 ${
                    overStage === stage ? "border-brass-300/60 bg-navy-800/60" : "border-stone-700/60 bg-navy-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
                    <p className="eyebrow">{STAGE_LABEL[stage]}</p>
                    <span className="font-mono text-xs text-stone-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <PostingCard key={p.id} posting={p} dragging={dragId === p.id} onDragStart={() => setDragId(p.id)} onClick={() => setSelected(p)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-4">
          <button className="eyebrow cursor-pointer hover:text-stone-200" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? "−" : "+"} {archived.length} archived
          </button>
          {showArchive && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((p) => <PostingCard key={p.id} posting={p} onClick={() => setSelected(p)} />)}
            </div>
          )}
        </div>
      )}

      {selected && <PostingDrawer posting={postings.find((p) => p.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function PostingCard({ posting: p, dragging, onDragStart, onClick }: { posting: Posting; dragging?: boolean; onDragStart?: () => void; onClick: () => void }) {
  const days = daysIn(p.stage_changed_at);
  const stale = days >= 10 && ["identified", "networking", "applied"].includes(p.stage);
  return (
    <div
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cursor-pointer rounded-md border bg-navy-900 p-3 shadow-soft transition-all duration-150 hover:shadow-deep ${
        stale ? "border-terracotta-600/70" : "border-stone-700"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-stone-400">{p.companies?.name ?? "—"}</p>
          <p className="mt-0.5 text-sm leading-snug text-stone-100">{p.title}</p>
        </div>
        {p.fit_score != null && <span className="font-mono text-xs text-stone-300">{p.fit_score}</span>}
      </div>
      <p className={`mt-2 font-mono text-[11px] ${stale ? "text-terracotta-300" : "text-stone-500"}`}>
        {days}d in {STAGE_LABEL[p.stage].toLowerCase()}
      </p>
    </div>
  );
}

function PostingDrawer({ posting: p, onClose }: { posting: Posting; onClose: () => void }) {
  const move = useMovePosting();
  const update = useUpdatePosting();
  const [notes, setNotes] = useState(p.notes ?? "");
  const fit = p.fit_detail as Fit | null;
  const comp = formatComp(p.comp_min, p.comp_max);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-stone-700 bg-navy-900 p-6 shadow-deep animate-fade" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <FitBadge score={p.fit_score} />
          <div className="flex-1">
            <p className="text-sm text-stone-400">{p.companies?.name}</p>
            <h2 className="text-lg font-semibold text-stone-100">{p.title}</h2>
            <p className="mt-1 text-sm text-stone-400">
              {[p.level, p.location, comp].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-stone-400 hover:text-stone-200" aria-label="Close">✕</button>
        </div>

        <div className="mt-5">
          <Label htmlFor="stage">Stage</Label>
          <select id="stage" className="field text-sm" value={p.stage} onChange={(e) => move.mutate({ id: p.id, stage: e.target.value as Stage })}>
            {[...STAGES, ...ARCHIVE_STAGES].map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </div>

        {p.fit_rationale && <p className="mt-5 text-stone-200">{p.fit_rationale}</p>}
        {fit && <div className="mt-4"><FitDetail fit={fit} /></div>}

        <div className="mt-6">
          <Label htmlFor="notes">Notes</Label>
          <textarea id="notes" className="field text-sm" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (p.notes ?? "") && update.mutate({ id: p.id, notes })} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link to={`/apply?posting=${p.id}`} className="text-sm text-brass-300 hover:underline">Tailor resume / cover letter →</Link>
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="text-sm text-stone-400 hover:text-stone-200">
              Open posting ↗
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const add = useAddPosting();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("identified");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await add.mutateAsync({ company, title, url, stage });
    onDone();
  }

  return (
    <form onSubmit={submit} className="card mb-6 grid gap-3 p-4 md:grid-cols-[1fr_1.4fr_1fr_160px_auto] md:items-end">
      <div><Label htmlFor="c">Company</Label><input id="c" className="field text-sm" required value={company} onChange={(e) => setCompany(e.target.value)} /></div>
      <div><Label htmlFor="t">Title</Label><input id="t" className="field text-sm" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label htmlFor="u">Link</Label><input id="u" className="field text-sm" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
      <div>
        <Label htmlFor="s">Stage</Label>
        <select id="s" className="field text-sm" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={add.isPending}>Add</Button>
      {add.error && <p className="text-sm text-terracotta-300 md:col-span-5">{(add.error as Error).message}</p>}
    </form>
  );
}
