"use client";

import { ExternalLink, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiError, checkKey } from "@/lib/ai/gemini";

import { aiErrorMessage } from "./messages";

const STUDIO_URL = "https://aistudio.google.com/apikey";

/**
 * What the assistant shows before it has a key: where to get one, a box to
 * paste it into, and what happens to it. The key is checked against Google
 * before it is saved, so a mistyped key is caught here rather than looking
 * like a broken app later.
 */
export function KeyGate({ onSaved }: { onSaved: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError("");
    try {
      await checkKey(trimmed);
      onSaved(trimmed);
    } catch (problem) {
      setError(
        problem instanceof AiError && problem.reason === "bad-key"
          ? "Google did not accept that key. Copy it again from AI Studio — it should be one long line with no spaces."
          : aiErrorMessage(problem),
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <section
      aria-label="Add your API key"
      className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1 sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h2 className="font-display text-xl font-semibold">Add your free Gemini key</h2>
      </div>

      <p className="text-muted-foreground text-pretty">
        The assistant runs on Google&apos;s Gemini. Bring your own key and it stays in this browser:
        your questions go straight from your device to Google, and this app has no server to send
        them through.
      </p>

      <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm">
        <li>
          Open{" "}
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
          >
            aistudio.google.com/apikey
            <ExternalLink className="size-3.5" aria-hidden />
          </a>{" "}
          and sign in with a Google account.
        </li>
        <li>
          Select <strong>Create API key</strong>, then pick a project (a new one is fine).
        </li>
        <li>Copy the key and paste it below. It is free, and no card is needed.</li>
      </ol>

      <form className="flex flex-col gap-2" onSubmit={(event) => void save(event)}>
        <Label htmlFor="gemini-key" className="text-muted-foreground text-xs">
          Gemini API key
        </Label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              id="gemini-key"
              className="h-11 pe-10 font-mono"
              type={visible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your key"
              value={key}
              aria-invalid={error !== ""}
              aria-describedby="gemini-key-error"
              onChange={(event) => {
                setKey(event.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              aria-label={visible ? "Hide the key" : "Show the key"}
              className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
              onClick={() => setVisible((shown) => !shown)}
            >
              {visible ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <Button type="submit" className="h-11 shrink-0" disabled={!key.trim() || checking}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {checking ? "Checking…" : "Save key"}
          </Button>
        </div>
        <p id="gemini-key-error" role="alert" className="text-destructive text-sm text-pretty">
          {error}
        </p>
      </form>

      <p className="text-muted-foreground flex items-start gap-2 text-sm text-pretty">
        <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        Your key is saved in this browser only, and is sent to Google alone, with your questions. It
        is never sent to us — this app has no account and no server — and you can remove it at any
        time in the assistant&apos;s settings.
      </p>
    </section>
  );
}
