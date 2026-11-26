import { useState, type FormEvent } from "react";
import { detectAts } from "@shared/jobs";
import { Button } from "@/platform/ui/Button";
import { Card, Empty, Label, PageHeader } from "@/platform/ui/primitives";
import type { Company } from "@/platform/data/types";
import { useCompanies, useSaveCompany } from "./data";

const ATS_LABEL: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workday: "Workday", other: "Not scannable" };

export function WatchlistPage() {
  const { data: companies = [], isLoading } = useCompanies();
  const watch = companies.filter((c) => c.watchlist);
  const [bulk, setBulk] = useState("");
  const save = useSaveCompany();

  async function addBulk(e: FormEvent) {
    e.preventDefault();
    const names = bulk.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      const existing = companies.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (!existing.watchlist) await save.mutateAsync({ id: existing.id, name: existing.name, watchlist: true });
      } else await save.mutateAsync({ name, watchlist: true });
    }
    setBulk("");
  }

  const scannable = watch.filter((c) => c.ats && c.ats !== "other").length;

  return (
    <>
      <PageHeader eyebrow="Search" title="Watchlist" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-stone-400">
        Companies you want to work for. Add each one's careers page and Discover scans it for product leadership roles.
        Greenhouse, Lever, Ashby and Workday boards can be scanned; anything else, paste the posting into Discover.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {isLoading ? null : watch.length === 0 ? (
            <Empty title="No companies yet">Add a few on the right, one per line.</Empty>
          ) : (
            <>
              <p className="eyebrow">{watch.length} companies · {scannable} scannable</p>
              {watch.map((c) => <CompanyRow key={c.id} company={c} />)}
            </>
          )}
        </div>
        <Card className="h-fit">
          <form onSubmit={addBulk} className="space-y-3">
            <Label htmlFor="bulk">Add companies (one per line)</Label>
            <textarea id="bulk" className="field text-sm" rows={8} placeholder={"Acme Corp\nExample Labs\nSample Co"} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <Button type="submit" className="w-full" disabled={!bulk.trim() || save.isPending}>Add to watchlist</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const save = useSaveCompany();
  const [url, setUrl] = useState(company.careers_url ?? "");
  const [editing, setEditing] = useState(!company.careers_url);
  const detected = url ? detectAts(url) : null;

  async function saveUrl() {
    await save.mutateAsync({
      id: company.id,
      name: company.name,
      careers_url: url || null,
      ats: url ? (detected?.ats ?? "other") : null,
      ats_config: detected?.ats_config ?? null,
    });
    setEditing(false);
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-stone-100">{company.name}</span>
        {company.ats && (
          <span className={`rounded border px-1.5 py-0.5 text-[11px] ${company.ats === "other" ? "border-stone-700 text-stone-500" : "border-sage-600 text-sage-300"}`}>
            {ATS_LABEL[company.ats]}
          </span>
        )}
        {company.last_scanned_at && <span className="text-xs text-stone-500">scanned {new Date(company.last_scanned_at).toLocaleDateString()}</span>}
        <div className="ml-auto flex gap-1">
          {!editing && <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(true)}>Edit</Button>}
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => save.mutate({ id: company.id, name: company.name, watchlist: false })}
          >
            Remove
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="field flex-1 text-sm"
            placeholder="Careers page URL, e.g. https://company.wd5.myworkdayjobs.com/Careers"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button variant="secondary" onClick={saveUrl} disabled={save.isPending}>Save</Button>
          {url && (
            <p className={`w-full text-xs ${detected ? "text-sage-300" : "text-stone-500"}`}>
              {detected ? `${ATS_LABEL[detected.ats]} board detected. It will be scanned.` : "Not a board we can scan yet. Paste its postings into Discover instead."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
