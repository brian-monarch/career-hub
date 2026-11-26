import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Fit } from "@shared/jobs";
import type { CoverLetter, TailoredResume, TailorResponse } from "@shared/apply";
import { Button } from "@/platform/ui/Button";
import { Card, Empty, Label, PageHeader } from "@/platform/ui/primitives";
import { supabase } from "@/platform/data/supabase";
import { callApi } from "@/platform/data/api";
import type { Posting } from "@/platform/data/types";
import { usePostings, useProfile } from "@/modules/search/data";

type Doc = { id: string; posting_id: string | null; kind: "base_resume" | "resume" | "cover_letter"; title: string | null; content: string; detail: unknown; created_at: string };

function useDocs() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data as Doc[];
    },
  });
}

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ApplyPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data: postings = [] } = usePostings();
  const { data: docs = [] } = useDocs();
  const { data: profile } = useProfile();

  const active = postings.filter((p) => !["rejected", "withdrawn", "closed"].includes(p.stage));
  const postingId = params.get("posting") ?? "";
  const posting = postings.find((p) => p.id === postingId);

  const base = docs.find((d) => d.kind === "base_resume");
  const [baseText, setBaseText] = useState("");
  const [editingBase, setEditingBase] = useState(false);
  const [instructions, setInstructions] = useState("");
  useEffect(() => setBaseText(base?.content ?? ""), [base?.id]);

  const saveBase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("documents").insert({ kind: "base_resume", title: "Base resume", content: baseText });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingBase(false);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const generate = useMutation({
    mutationFn: async (kind: "resume" | "cover_letter") => {
      if (!posting || !base) throw new Error("Pick a role and save your base resume first.");
      const fit = posting.fit_detail as Fit | null;
      const res = await callApi<TailorResponse>("/api/tailor", {
        kind,
        baseResume: base.content,
        headline: profile?.headline ?? null,
        instructions: instructions || null,
        posting: {
          company: posting.companies?.name ?? "",
          title: posting.title,
          description: posting.description,
          fitNotes: fit ? [fit.headline, ...fit.why_you, ...fit.gaps].join("\n") : posting.fit_rationale,
        },
      });
      const content = res.kind === "resume" ? res.result.resume : res.result.letter;
      const { error } = await supabase.from("documents").insert({
        posting_id: posting.id,
        kind,
        title: `${kind === "resume" ? "Resume" : "Cover letter"} · ${posting.companies?.name ?? ""} · ${posting.title}`,
        content,
        detail: res.result,
        model: res.model,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const forPosting = docs.filter((d) => d.posting_id === postingId);

  return (
    <>
      <PageHeader eyebrow="Apply" title="Tailor resume and cover letter" />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <Label htmlFor="role">Role</Label>
            <select id="role" className="field text-sm" value={postingId} onChange={(e) => setParams(e.target.value ? { posting: e.target.value } : {})}>
              <option value="">Choose a role from your pipeline</option>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.companies?.name} · {p.title}
                </option>
              ))}
            </select>
            {posting && !posting.description && (
              <p className="mt-2 text-xs text-brass-300">No job description saved for this role. Results will be generic; add it via Discover's paste box for a better match.</p>
            )}
            <div className="mt-4">
              <Label htmlFor="instr">Anything to emphasize (optional)</Label>
              <textarea id="instr" className="field text-sm" rows={3} placeholder="e.g. Lead with the platform work; mention I'm local." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => generate.mutate("resume")} disabled={!posting || !base || generate.isPending}>
                {generate.isPending && generate.variables === "resume" ? "Tailoring… (about a minute)" : "Tailor my resume"}
              </Button>
              <Button variant="secondary" onClick={() => generate.mutate("cover_letter")} disabled={!posting || !base || generate.isPending}>
                {generate.isPending && generate.variables === "cover_letter" ? "Writing…" : "Write a cover letter"}
              </Button>
            </div>
            {generate.error && <p className="mt-3 text-sm text-terracotta-300">{(generate.error as Error).message}</p>}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="font-medium text-stone-100">Base resume</p>
              {base && !editingBase && (
                <button className="cursor-pointer text-xs text-stone-400 hover:text-stone-200" onClick={() => setEditingBase(true)}>Edit</button>
              )}
            </div>
            {!base || editingBase ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-stone-500">Paste your current resume as text. Every tailored version starts from this, and nothing is added that isn't in it.</p>
                <textarea className="field font-mono text-xs" rows={12} value={baseText} onChange={(e) => setBaseText(e.target.value)} />
                <Button className="w-full" disabled={baseText.trim().length < 200 || saveBase.isPending} onClick={() => saveBase.mutate()}>Save base resume</Button>
                {saveBase.error && <p className="text-xs text-terracotta-300">{(saveBase.error as Error).message}</p>}
              </div>
            ) : (
              <p className="mt-2 text-xs text-stone-500">Saved {new Date(base.created_at).toLocaleDateString()} · {base.content.split(/\s+/).length} words</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {!posting ? (
            <Empty title="Pick a role">Choose a role from your pipeline. Tailored resumes and letters are saved under each role.</Empty>
          ) : forPosting.length === 0 ? (
            <Empty title={`Nothing for ${posting.companies?.name ?? "this role"} yet`}>Tailor your resume or write a cover letter. Every version is kept.</Empty>
          ) : (
            forPosting.map((d) => <DocCard key={d.id} doc={d} posting={posting} />)
          )}
        </div>
      </div>
    </>
  );
}

function DocCard({ doc, posting }: { doc: Doc; posting: Posting }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  const detail = doc.detail as (TailoredResume & CoverLetter) | null;
  const slug = `${posting.companies?.name ?? "role"}-${doc.kind}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <button className="flex-1 cursor-pointer text-left" onClick={() => setOpen((v) => !v)}>
          <p className="eyebrow">{doc.kind === "resume" ? "Tailored resume" : "Cover letter"}</p>
          <p className="text-xs text-stone-500">{new Date(doc.created_at).toLocaleString()}</p>
        </button>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(doc.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => download(`${slug}.md`, doc.content)}>Download</Button>
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          {detail?.angle && <p className="text-sm text-stone-400">{detail.angle}</p>}
          {detail?.changes?.length ? (
            <div>
              <p className="eyebrow">What changed</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-stone-300 marker:text-sage-400">
                {detail.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ) : null}
          {detail?.keywords_missing?.length ? (
            <p className="text-sm text-stone-400">
              <span className="text-brass-300">Not in your resume:</span> {detail.keywords_missing.join(", ")}. Add only what you've really done.
            </p>
          ) : null}
          {detail?.questions?.length ? (
            <div className="rounded-md border border-brass-300/40 p-3">
              <p className="eyebrow text-brass-300">Make it stronger</p>
              <ul className="mt-1.5 space-y-1 text-sm text-stone-300">
                {detail.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          ) : null}
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-stone-700 bg-navy-950 p-4 font-sans text-sm leading-relaxed text-stone-200">
            {doc.content}
          </pre>
        </div>
      )}
    </Card>
  );
}
