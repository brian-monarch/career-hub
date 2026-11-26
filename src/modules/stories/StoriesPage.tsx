import { useState, type FormEvent } from "react";
import { Button } from "@/platform/ui/Button";
import { Card, Empty, Label, PageHeader } from "@/platform/ui/primitives";
import { useDeleteStory, useSaveStory, useStories } from "@/platform/data/queries";
import type { Story, StoryInput } from "@/platform/data/types";

const FIELDS: { key: keyof StoryInput; label: string; hint: string; rows: number }[] = [
  { key: "situation", label: "Situation", hint: "Context in two sentences. Scale, stakes, what was broken.", rows: 3 },
  { key: "task", label: "Task", hint: "What you owned.", rows: 2 },
  { key: "action", label: "Action", hint: "What you did, in order. Use I.", rows: 4 },
  { key: "result", label: "Result", hint: "The outcome, with the before and after.", rows: 3 },
  { key: "metrics", label: "Metrics", hint: "Every number you can defend: $, %, time, people.", rows: 2 },
  { key: "my_decision", label: "The decision I made", hint: "The call that was yours, the alternative, and what you gave up.", rows: 3 },
];

const blank: StoryInput = {
  title: "",
  pillar: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  metrics: "",
  my_decision: "",
  tags: [],
};

export function StoriesPage() {
  const { data: stories = [], isLoading, error } = useStories();
  const [editing, setEditing] = useState<(StoryInput & { id?: string }) | null>(null);

  return (
    <>
      <PageHeader eyebrow="Prepare" title="Story bank">
        {!editing && <Button onClick={() => setEditing({ ...blank })}>New story</Button>}
      </PageHeader>

      {editing ? (
        <StoryForm initial={editing} onDone={() => setEditing(null)} />
      ) : isLoading ? null : error ? (
        <Empty title="Couldn't load stories">{(error as Error).message}</Empty>
      ) : stories.length === 0 ? (
        <Empty title="No stories yet">
          Add your 4 to 6 hero stories. The coach checks every answer against them for missing proof.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} onEdit={() => setEditing(s)} />
          ))}
        </div>
      )}
    </>
  );
}

function StoryCard({ story, onEdit }: { story: Story; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="card cursor-pointer p-5 text-left transition-shadow duration-150 hover:shadow-deep">
      {story.pillar && <p className="eyebrow">{story.pillar}</p>}
      <p className="mt-1 font-medium text-stone-100">{story.title}</p>
      {story.my_decision && <p className="mt-2 line-clamp-3 text-sm text-stone-400">{story.my_decision}</p>}
      {story.metrics && <p className="mt-3 line-clamp-2 font-mono text-xs text-sage-300">{story.metrics}</p>}
    </button>
  );
}

function StoryForm({ initial, onDone }: { initial: StoryInput & { id?: string }; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const save = useSaveStory();
  const del = useDeleteStory();
  const set = (k: keyof StoryInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    await save.mutateAsync({
      id: form.id,
      title: form.title,
      pillar: form.pillar || null,
      situation: form.situation || null,
      task: form.task || null,
      action: form.action || null,
      result: form.result || null,
      metrics: form.metrics || null,
      my_decision: form.my_decision || null,
      tags: form.tags,
    });
    onDone();
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div>
            <Label htmlFor="title">Title</Label>
            <input id="title" className="field" required value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pillar">Pillar</Label>
            <input
              id="pillar"
              className="field"
              placeholder="e.g. Measurement, Turnaround"
              value={form.pillar ?? ""}
              onChange={(e) => set("pillar", e.target.value)}
            />
          </div>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <textarea
              id={f.key}
              className="field text-sm leading-relaxed"
              rows={f.rows}
              placeholder={f.hint}
              value={(form[f.key] as string | null) ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
        {save.error && <p className="text-sm text-terracotta-300">{(save.error as Error).message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save story"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          {form.id && (
            <Button
              type="button"
              variant="danger"
              className="ml-auto"
              onClick={async () => {
                if (!confirmDelete(form.title)) return;
                await del.mutateAsync(form.id!);
                onDone();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function confirmDelete(title: string) {
  return window.confirm(`Delete "${title}"? Practice takes keep their transcripts.`);
}
