import type { Fit } from "@shared/jobs";

const CHECK_TEXT: Record<string, Record<string, [string, "good" | "warn" | "bad" | "neutral"]>> = {
  level: { match: ["Level matches", "good"], above: ["Level above target", "warn"], below: ["Level below target", "bad"], unclear: ["Level unclear", "neutral"] },
  comp: {
    above_good: ["Comp clears your floors", "good"],
    between_floors: ["Comp OK for an ideal role", "warn"],
    below_ideal: ["Comp below your floor", "bad"],
    not_posted: ["Comp not posted", "neutral"],
  },
  location: { ok: ["Location works", "good"], not_ok: ["Location doesn't work", "bad"], unclear: ["Location unclear", "neutral"] },
  domain: { core: ["Core domain", "good"], adjacent: ["Adjacent domain", "warn"], outside: ["Outside your domains", "bad"] },
};

const TONE = {
  good: "border-sage-600 text-sage-300",
  warn: "border-brass-300/50 text-brass-300",
  bad: "border-terracotta-600 text-terracotta-300",
  neutral: "border-stone-700 text-stone-400",
};

export function FitBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-stone-700 font-mono text-xs text-stone-500">…</span>;
  const tone =
    score >= 9 ? "border-brass-300 text-brass-300" : score >= 7 ? "border-sage-600 text-sage-300" : score >= 5 ? "border-stone-700 text-stone-300" : "border-stone-700 text-stone-500";
  return <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold ${tone}`}>{score}</span>;
}

export function formatComp(min: number | null, max: number | null) {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  if (min || max) return k((min ?? max)!);
  return null;
}

export function FitDetail({ fit }: { fit: Fit }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-stone-400">{fit.parsed.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CHECK_TEXT) as (keyof Fit["checks"])[]).map((k) => {
          const [label, tone] = CHECK_TEXT[k][fit.checks[k]] ?? [fit.checks[k], "neutral"];
          return (
            <span key={k} className={`rounded border px-2 py-0.5 text-xs ${TONE[tone]}`}>
              {label}
            </span>
          );
        })}
        <span className="rounded border border-stone-700 px-2 py-0.5 text-xs text-stone-400">{fit.parsed.work_model}</span>
      </div>
      {fit.deal_breakers_hit.length > 0 && (
        <p className="text-terracotta-300">Deal breaker: {fit.deal_breakers_hit.join("; ")}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="eyebrow">Why you</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-stone-300 marker:text-sage-400">
            {fit.why_you.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
        {fit.gaps.length > 0 && (
          <div>
            <p className="eyebrow">Gaps and how to frame them</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-stone-300 marker:text-stone-500">
              {fit.gaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
