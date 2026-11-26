import { useState } from "react";
import { RUBRIC, type CoachResponse } from "@shared/coach";
import { Button } from "@/platform/ui/Button";
import { Card, ScorePill } from "@/platform/ui/primitives";

export function FeedbackPanel({ result, onProbe }: { result: CoachResponse; onProbe: () => void }) {
  const f = result.feedback;
  const [showRewrite, setShowRewrite] = useState(false);
  const weakest = [...RUBRIC].sort((a, b) => f.scores[a.key].score - f.scores[b.key].score)[0];

  return (
    <div className="space-y-4 animate-fade">
      <Card>
        <div className="flex items-start gap-4">
          <div className="text-center">
            <p className="font-mono text-3xl font-semibold text-stone-100">{result.overall.toFixed(1)}</p>
            <p className="eyebrow mt-0.5">of 5</p>
          </div>
          <div className="flex-1">
            <p className="text-stone-100">{f.headline}</p>
            <p className="mt-1 text-sm text-stone-400">
              Weakest: <span className="text-terracotta-300">{weakest.label}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-stone-700/60">
          {RUBRIC.map((r) => (
            <div key={r.key} className="flex gap-4 py-2.5">
              <div className="w-36 shrink-0 text-sm text-stone-300">{r.label}</div>
              <ScorePill score={f.scores[r.key].score} />
              <p className="flex-1 text-sm text-stone-400">{f.scores[r.key].evidence}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-terracotta-600/60">
          <p className="eyebrow text-terracotta-300">Missing proof</p>
          <p className="mt-2 text-sm text-stone-200">{f.missing_proof}</p>
        </Card>
        <Card>
          <p className="eyebrow">Story fit</p>
          <p className="mt-2 text-sm text-stone-200">{f.story_fit}</p>
        </Card>
      </div>

      {f.we_to_i.length > 0 && (
        <Card>
          <p className="eyebrow">"We" that should be "I"</p>
          <ul className="mt-3 space-y-3">
            {f.we_to_i.map((w, i) => (
              <li key={i} className="text-sm">
                <p className="text-stone-500 line-through decoration-terracotta-400/60">{w.quote}</p>
                <p className="mt-0.5 text-sage-300">{w.rewrite}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {f.strengths.length > 0 && (
        <Card>
          <p className="eyebrow">Keep</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-300 marker:text-sage-400">
            {f.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <button className="eyebrow cursor-pointer hover:text-stone-200" onClick={() => setShowRewrite((v) => !v)}>
          {showRewrite ? "−" : "+"} Tighter version
        </button>
        {showRewrite && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-200">{f.rewrite}</p>}
      </Card>

      <section className="card-raised border-brass-300/40 p-5">
        <p className="eyebrow text-brass-300">Next, the interviewer asks</p>
        <p className="mt-2 text-stone-100">{f.probe}</p>
        <Button className="mt-4" onClick={onProbe}>
          Answer the follow-up
        </Button>
      </section>

      <p className="text-right font-mono text-[11px] text-stone-500">
        {result.model} · {result.usage.input_tokens + result.usage.output_tokens} tokens
      </p>
    </div>
  );
}
