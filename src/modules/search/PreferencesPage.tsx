import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/platform/ui/Button";
import { Card, Label, PageHeader } from "@/platform/ui/primitives";
import type { SearchProfileRow } from "@/platform/data/types";
import { EMPTY_PROFILE, useProfile, useSaveProfile } from "./data";

const LIST_FIELDS: { key: "target_titles" | "target_levels" | "domains" | "locations"; label: string; placeholder: string }[] = [
  { key: "target_titles", label: "Target titles", placeholder: "Director of Product, Head of Product, Senior Director Product Management" },
  { key: "target_levels", label: "Levels", placeholder: "Director, Senior Director" },
  { key: "domains", label: "Preferred domains", placeholder: "e.g. Data platforms, marketplaces, fintech" },
  { key: "locations", label: "Locations", placeholder: "e.g. Chicago, Remote (US)" },
];

const toList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const toNum = (s: string) => (s.trim() ? Number(s.replace(/[^0-9.]/g, "")) * (/k$/i.test(s.trim()) ? 1000 : 1) : null);

export function PreferencesPage() {
  const { data, isLoading } = useProfile();
  const save = useSaveProfile();
  const [form, setForm] = useState<Record<string, string>>({});
  const [remoteOk, setRemoteOk] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = data ?? EMPTY_PROFILE;
    setForm({
      headline: p.headline ?? "",
      target_titles: p.target_titles.join(", "),
      target_levels: p.target_levels.join(", "),
      domains: p.domains.join(", "),
      locations: p.locations.join(", "),
      max_travel_pct: p.max_travel_pct?.toString() ?? "",
      comp_floor_ideal: p.comp_floor_ideal?.toString() ?? "",
      comp_floor_good: p.comp_floor_good?.toString() ?? "",
      must_haves: p.must_haves ?? "",
      deal_breakers: p.deal_breakers ?? "",
      boosts: p.boosts ?? "",
    });
    setRemoteOk(p.remote_ok);
  }, [data]);

  const set = (k: string, v: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const row: SearchProfileRow = {
      headline: form.headline || null,
      target_titles: toList(form.target_titles),
      target_levels: toList(form.target_levels),
      domains: toList(form.domains),
      locations: toList(form.locations),
      remote_ok: remoteOk,
      max_travel_pct: toNum(form.max_travel_pct),
      comp_floor_ideal: toNum(form.comp_floor_ideal),
      comp_floor_good: toNum(form.comp_floor_good),
      must_haves: form.must_haves || null,
      deal_breakers: form.deal_breakers || null,
      boosts: form.boosts || null,
    };
    await save.mutateAsync(row);
    setSaved(true);
  }

  if (isLoading) return null;

  return (
    <>
      <PageHeader eyebrow="Search" title="Search preferences" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-stone-400">
        Every role is scored against this. It lives only in your database, never in the code.
      </p>
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="headline">Who you are, in two or three sentences</Label>
            <textarea
              id="headline"
              className="field text-sm"
              rows={3}
              placeholder="Principal PM with 18 years in retail data, measurement and retail media; former Director leading PM teams..."
              value={form.headline ?? ""}
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {LIST_FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key}>{f.label} (comma separated)</Label>
                <input id={f.key} className="field text-sm" placeholder={f.placeholder} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            <div>
              <Label htmlFor="ideal">Total comp, ideal role</Label>
              <input id="ideal" className="field font-mono text-sm" placeholder="e.g. 200k" value={form.comp_floor_ideal ?? ""} onChange={(e) => set("comp_floor_ideal", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="good">Total comp, good role</Label>
              <input id="good" className="field font-mono text-sm" placeholder="e.g. 220k" value={form.comp_floor_good ?? ""} onChange={(e) => set("comp_floor_good", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="travel">Max travel %</Label>
              <input id="travel" className="field font-mono text-sm" placeholder="25" value={form.max_travel_pct ?? ""} onChange={(e) => set("max_travel_pct", e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-stone-300">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-sage-400)]" checked={remoteOk} onChange={(e) => { setSaved(false); setRemoteOk(e.target.checked); }} />
              Open to remote
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="must">Must haves</Label>
              <textarea id="must" className="field text-sm" rows={3} placeholder="Leads a team of PMs; owns strategy, not just delivery" value={form.must_haves ?? ""} onChange={(e) => set("must_haves", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="deal">Deal breakers</Label>
              <textarea id="deal" className="field text-sm" rows={3} placeholder="e.g. Relocation; fully on-site; IC-only roles" value={form.deal_breakers ?? ""} onChange={(e) => set("deal_breakers", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="boosts">Boosts: what makes a company worth a look outside your domains</Label>
            <textarea id="boosts" className="field text-sm" rows={2} placeholder="e.g. Well respected; local; tech-oriented; an industry you care about" value={form.boosts ?? ""} onChange={(e) => set("boosts", e.target.value)} />
          </div>
          {save.error && <p className="text-sm text-terracotta-300">{(save.error as Error).message}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save preferences"}</Button>
            {saved && <span className="text-sm text-sage-300">Saved</span>}
          </div>
        </form>
      </Card>
    </>
  );
}
