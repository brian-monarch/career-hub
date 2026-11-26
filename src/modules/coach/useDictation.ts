import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (Chrome, Edge, Safari).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const RecognitionCtor: (new () => Recognition) | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition as new () => Recognition) ??
      ((window as unknown as Record<string, unknown>).webkitSpeechRecognition as new () => Recognition)
    : undefined;

export const dictationSupported = Boolean(RecognitionCtor);

/**
 * Live speech-to-text in the browser, plus an answer timer.
 * Final text is appended through onFinal; interim text is shown while speaking.
 */
export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => {
      if (startedAt.current) setElapsed(accumulated.current + (Date.now() - startedAt.current) / 1000);
    }, 250);
    return () => clearInterval(t);
  }, [listening]);

  const start = useCallback(() => {
    if (!RecognitionCtor) return;
    setError(null);
    const rec = new RecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim());
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone: ${e.error}`);
    };
    // Browsers end recognition after silence; restart while the user still wants it.
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    wantRef.current = true;
    startedAt.current = Date.now();
    rec.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    if (startedAt.current) accumulated.current += (Date.now() - startedAt.current) / 1000;
    startedAt.current = null;
    setElapsed(accumulated.current);
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stop();
    accumulated.current = 0;
    setElapsed(0);
    setInterim("");
  }, [stop]);

  useEffect(() => () => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  return { listening, interim, error, elapsed, start, stop, reset };
}
