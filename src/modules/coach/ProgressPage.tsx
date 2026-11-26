import { useMemo, useState } from "react";
import { RUBRIC, type CoachFeedback } from "@shared/coach";
import { Card, Empty, PageHeader, ScorePill } from "@/platform/ui/primitives";
import { useStories, useTakes } from "@/platform/data/queries";
import type { FeedbackRow, TakeWithFeedback } from "@/platform/data/types";

const COL: Record<(typeof RUBRIC)[number]["key"], keyof FeedbackRow> = {
  structure: "score_structure",
  specificity: "score_specificity",
  impact: "score_impact",
  ownership: "score_ownership",
  relevance: "score_relevance",
  length: "score_length",
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function ProgressPage() {
  const { data: takes = [], isLoading, error } = useTakes();
  const { data: stories = [] } = useStories();
  const [open, setOpen] = useState<string | null>(null);

  const scored = takes.filter((t) => t.feedback[0]);

  const dims = useMemo(() => {
    const recent = scored.slice(0, 10);
    const earlier = scored.slice(10, 20);
    return RUBRIC.map((r) => ({
      ...r,
      recent: avg(recent.map((t) => Number(t.feedback[0][COL[r.key]]))),
      earlier: avg(earlier.map((t) => Number(t.feedback[0][COL[r.key]]))),
    }));
  }, [scored]);

  const storyRows = useMemo(
    () =>
      stories.map((s) => {
        const ts = scored.filter((t) => t.story_id === s.id);
        const strong = ts.filter((t) => Number(t.feedback[0].overall) >= 4).length;
        return { story: s, takes: ts.length, best: Math.max(0, ...ts.map((t) => Number(t.feedback[0].overall))), ready: strong >= 3 };
      }),
    [stories, scored],
  );

  if (isLoading) return null;
  if (error) return <Empty title="Couldn't load progress">{(error as Error).message}</Empty>;

  return (
    <>
      <PageHeader eyebrow="Prepare" title="Progress" />
      {scored.length === 0 ? (
        <Empty title="No scored answers yet">Run a mock interview and your scores land here.</Empty>
      ) : (
        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Rubric, last 10 answers</p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {dims.map((d) => (
                <div key={d.key}>
                  <p className="text-xs text-stone-400">{d.label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <ScorePill score={d.recent} />
                    {d.recent != null && d.earlier != null && (
                      <span className={`font-mono text-xs ${d.recent >= d.earlier ? "text-sage-300" : "text-terracotta-300"}`}>
                        {d.recent >= d.earlier ? "+" : ""}
                        {(d.recent - d.earlier).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {storyRows.length > 0 && (
            <Card>
              <p className="eyebrow">Stories</p>
              <p className="mt-1 text-xs text-stone-500">Interview ready = three answers scored 4.0 or better.</p>
              <div className="mt-3 divide-y divide-stone-700/60">
                {storyRows.map((r) => (
                  <div key={r.story.id} className="flex items-center gap-4 py-2.5 text-sm">
                    <span className="flex-1 text-stone-200">{r.story.title}</span>
                    <span className="font-mono text-xs text-stone-400">{r.takes} takes</span>
                    <ScorePill score={r.takes ? r.best : null} />
                    <span className={`w-24 text-right text-xs ${r.ready ? "text-sage-300" : "text-stone-500"}`}>
                      {r.ready ? "Ready" : "Not yet"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <p className="eyebrow">All answers</p>
            <div className="mt-3 divide-y divide-stone-700/60">
              {scored.map((t) => (
                <TakeRow key={t.id} take={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function TakeRow({ take, open, onToggle }: { take: TakeWithFeedback; open: boolean; onToggle: () => void }) {
  const fb = take.feedback[0];
  const detail = fb.detail as CoachFeedback;
  return (
    <div className="py-3">
      <button onClick={onToggle} className="flex w-full cursor-pointer items-center gap-4 text-left">
        <ScorePill score={Number(fb.overall)} />
        <span className="flex-1 truncate text-sm text-stone-200">
          {take.is_probe && <span className="mr-1 text-brass-300">↳</span>}
          {take.question_text}
        </span>
        <span className="font-mono text-xs text-stone-500">{new Date(take.created_at).toLocaleDateString()}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 pl-13 text-sm animate-fade">
          <p className="text-stone-300">{detail.headline}</p>
          <p className="whitespace-pre-line text-stone-400">{take.transcript}</p>
          <p className="text-terracotta-300">Missing: {detail.missing_proof}</p>
        </div>
      )}
    </div>
  );
}
