import { useMemo, useState } from "react";
import { PERSONAS, deliveryStats, type CoachResponse, type PersonaKey } from "@shared/coach";
import { Button } from "@/platform/ui/Button";
import { Card, Label, PageHeader } from "@/platform/ui/primitives";
import { useStories } from "@/platform/data/queries";
import { useQueryClient } from "@tanstack/react-query";
import { QUESTION_LIBRARY, CATEGORY_LABEL } from "./questions";
import { requestFeedback, saveTake } from "./api";
import { dictationSupported, useDictation } from "./useDictation";
import { FeedbackPanel } from "./FeedbackPanel";

type Turn = { question: string; answer: string };

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function CoachPage() {
  const qc = useQueryClient();
  const { data: stories = [] } = useStories();

  const [persona, setPersona] = useState<PersonaKey>("hiring_manager");
  const [question, setQuestion] = useState(QUESTION_LIBRARY[1].text);
  const [customQuestion, setCustomQuestion] = useState("");
  const [storyId, setStoryId] = useState<string>("");
  const [targetRole, setTargetRole] = useState("");
  const [showRole, setShowRole] = useState(false);

  const [answer, setAnswer] = useState("");
  const [isProbe, setIsProbe] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [status, setStatus] = useState<"idle" | "scoring" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [saveWarning, setSaveWarning] = useState("");

  const dictation = useDictation((text) => setAnswer((a) => (a ? `${a} ${text}` : text)));
  const liveText = dictation.interim ? `${answer} ${dictation.interim}`.trim() : answer;
  const stats = useMemo(
    () => deliveryStats(liveText, dictation.elapsed > 0 ? Math.round(dictation.elapsed) : null),
    [liveText, dictation.elapsed],
  );

  const story = stories.find((s) => s.id === storyId);
  const activeQuestion = customQuestion.trim() || question;

  function newQuestion(q: string) {
    setQuestion(q);
    setCustomQuestion("");
    setIsProbe(false);
    setHistory([]);
    setSessionId(null);
    clearAnswer();
  }

  function clearAnswer() {
    dictation.reset();
    setAnswer("");
    setResult(null);
    setStatus("idle");
    setError("");
    setSaveWarning("");
  }

  async function submit() {
    if (dictation.listening) dictation.stop();
    const transcript = answer.trim();
    if (transcript.split(/\s+/).length < 5) {
      setError("Give a fuller answer before scoring.");
      setStatus("error");
      return;
    }
    setStatus("scoring");
    setError("");
    setSaveWarning("");
    const s = deliveryStats(transcript, dictation.elapsed > 0 ? Math.round(dictation.elapsed) : null);
    try {
      const res = await requestFeedback({
        question: activeQuestion,
        answer: transcript,
        persona,
        targetRole: targetRole.trim() || undefined,
        story: story
          ? {
              title: story.title,
              situation: story.situation,
              task: story.task,
              action: story.action,
              result: story.result,
              metrics: story.metrics,
              my_decision: story.my_decision,
            }
          : undefined,
        storyTitles: stories.map((x) => x.title),
        delivery: s,
        previous: history.slice(-4),
      });
      setResult(res);
      setStatus("idle");
      try {
        const saved = await saveTake({
          sessionId,
          persona,
          question: activeQuestion,
          isProbe,
          storyId: storyId || null,
          transcript,
          stats: s,
          result: res,
        });
        setSessionId(saved.sessionId);
        qc.invalidateQueries({ queryKey: ["takes"] });
      } catch (e) {
        setSaveWarning(`Scored, but not saved: ${(e as Error).message}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function answerProbe() {
    if (!result) return;
    setHistory((h) => [...h, { question: activeQuestion, answer: answer.trim() }]);
    setQuestion(result.feedback.probe);
    setCustomQuestion("");
    setIsProbe(true);
    dictation.reset();
    setAnswer("");
    setResult(null);
  }

  const overTime = stats.durationS != null && stats.durationS > 150;

  return (
    <>
      <PageHeader eyebrow="Prepare" title="Mock interview">
        {history.length > 0 && (
          <span className="self-center text-xs text-stone-400">Follow-up {history.length} in this thread</span>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Setup */}
        <Card className="h-fit space-y-5">
          <div>
            <Label htmlFor="persona">Interviewer</Label>
            <select id="persona" className="field" value={persona} onChange={(e) => setPersona(e.target.value as PersonaKey)}>
              {Object.entries(PERSONAS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{PERSONAS[persona].brief}</p>
          </div>

          <div>
            <Label htmlFor="question">Question</Label>
            <select id="question" className="field" value={question} onChange={(e) => newQuestion(e.target.value)}>
              {isProbe && <option value={question}>Follow-up: {question.slice(0, 60)}…</option>}
              {Object.entries(CATEGORY_LABEL).map(([cat, label]) => (
                <optgroup key={cat} label={label}>
                  {QUESTION_LIBRARY.filter((q) => q.category === cat).map((q) => (
                    <option key={q.text} value={q.text}>
                      {q.text}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              className="field mt-2 text-sm"
              placeholder="Or type a question you were asked"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="story">Story you'll use</Label>
            <select id="story" className="field" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
              <option value="">None / let the coach suggest</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            {stories.length === 0 && (
              <p className="mt-1.5 text-xs text-stone-500">Add hero stories in the Story bank so the coach can check for missing proof.</p>
            )}
          </div>

          <div>
            <button className="eyebrow cursor-pointer hover:text-stone-200" onClick={() => setShowRole((v) => !v)}>
              {showRole ? "−" : "+"} Target role (optional)
            </button>
            {showRole && (
              <textarea
                className="field mt-2 h-28 text-sm"
                placeholder="Paste the job title and key lines from the posting so feedback is tailored."
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            )}
          </div>
        </Card>

        {/* Answer + feedback */}
        <div className="space-y-6">
          <section className="card-raised p-6">
            <p className="eyebrow">{isProbe ? `${PERSONAS[persona].label} follows up` : PERSONAS[persona].label}</p>
            <p className="mt-2 text-lg leading-snug text-stone-100">{activeQuestion}</p>

            <div className="mt-5">
              <textarea
                className="field min-h-48 leading-relaxed"
                placeholder={dictationSupported ? "Press Record and answer out loud, or type here." : "Type your answer here."}
                value={liveText}
                onChange={(e) => setAnswer(e.target.value)}
                readOnly={dictation.listening}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-stone-400">
              <span className={overTime ? "text-terracotta-300" : ""}>
                {fmtTime(dictation.elapsed)} {overTime && "· over 2:30"}
              </span>
              <span>{stats.wordCount} words</span>
              {stats.wordsPerMin && <span>{stats.wordsPerMin} wpm</span>}
              <span className={stats.weCount > stats.iCount && stats.weCount > 2 ? "text-terracotta-300" : ""}>
                we {stats.weCount} · I {stats.iCount}
              </span>
              <span>fillers {stats.fillerCount}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {dictationSupported &&
                (dictation.listening ? (
                  <Button variant="danger" onClick={dictation.stop}>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-terracotta-400" /> Stop
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={dictation.start} disabled={status === "scoring"}>
                    <span className="h-2 w-2 rounded-full bg-terracotta-400" /> {answer ? "Keep recording" : "Record"}
                  </Button>
                ))}
              <Button onClick={submit} disabled={status === "scoring" || !answer.trim()}>
                {status === "scoring" ? "Scoring…" : "Score my answer"}
              </Button>
              {(answer || result) && (
                <Button variant="ghost" onClick={clearAnswer} disabled={status === "scoring"}>
                  Start over
                </Button>
              )}
            </div>
            {dictation.error && <p className="mt-3 text-sm text-terracotta-300">{dictation.error}</p>}
            {status === "error" && <p className="mt-3 text-sm text-terracotta-300">{error}</p>}
            {saveWarning && <p className="mt-3 text-sm text-terracotta-300">{saveWarning}</p>}
          </section>

          {status === "scoring" && (
            <Card className="animate-pulse text-sm text-stone-400">Reading your answer against the rubric…</Card>
          )}
          {result && <FeedbackPanel result={result} onProbe={answerProbe} />}
        </div>
      </div>
    </>
  );
}
