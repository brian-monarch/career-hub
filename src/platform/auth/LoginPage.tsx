import { useState, type FormEvent } from "react";
import { supabase } from "@/platform/data/supabase";
import { Button } from "@/platform/ui/Button";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const [showEmail, setShowEmail] = useState(false);

  async function google() {
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else setStatus("sent");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card-raised w-full max-w-sm p-8 animate-fade">
        <p className="eyebrow">Career Hub</p>
        <h1 className="mt-2 text-xl font-semibold text-stone-100">Sign in</h1>
        {status === "sent" ? (
          <p className="mt-4 text-sm text-stone-400">
            Check <span className="text-stone-200">{email}</span> for a sign-in
            link. It opens this app signed in.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              disabled={status === "sending"}
              onClick={google}
            >
              Continue with Google
            </Button>
            {!showEmail && (
              <button
                type="button"
                className="w-full text-xs text-stone-500 hover:text-stone-300"
                onClick={() => setShowEmail(true)}
              >
                Use an email link instead
              </button>
            )}
            {showEmail && (
              <form onSubmit={submit} className="space-y-3">
                <input
                  className="field"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={status === "sending"}
                >
                  {status === "sending"
                    ? "Sending link…"
                    : "Email me a sign-in link"}
                </Button>
              </form>
            )}
            {status === "error" && (
              <p className="text-sm text-terracotta-300">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SetupNeeded() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card-raised w-full max-w-md p-8">
        <p className="eyebrow">Career Hub</p>
        <h1 className="mt-2 text-xl font-semibold text-stone-100">
          Almost there
        </h1>
        <p className="mt-3 text-sm text-stone-400">
          This deploy is missing{" "}
          <code className="font-mono text-brass-300">VITE_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="font-mono text-brass-300">
            VITE_SUPABASE_ANON_KEY
          </code>
          . Add them in Vercel under Project Settings, Environment Variables,
          then redeploy.
        </p>
      </div>
    </div>
  );
}
