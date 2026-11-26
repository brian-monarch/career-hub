import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-100">{title}</h1>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </header>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`card p-5 ${className}`}>{children}</section>;
}

/** 1-5 rubric score. Sage at 4+, terracotta at 2 or below. */
export function ScorePill({ score, max = 5 }: { score: number | null | undefined; max?: number }) {
  if (score == null) return <span className="font-mono text-stone-500">–</span>;
  const ratio = score / max;
  const tone =
    ratio >= 0.8 ? "text-sage-300 border-sage-600" : ratio <= 0.4 ? "text-terracotta-300 border-terracotta-600" : "text-stone-200 border-stone-700";
  return (
    <span className={`inline-flex min-w-9 justify-center rounded border px-1.5 py-0.5 font-mono text-sm ${tone}`}>
      {Number.isInteger(score) ? score : score.toFixed(1)}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card border-dashed p-10 text-center">
      <p className="font-medium text-stone-200">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-400">{children}</div>}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow mb-1.5 block">
      {children}
    </label>
  );
}
