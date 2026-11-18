"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PollDefinition, PollResults } from "@/lib/polls";

type PollProps = { poll: PollDefinition } & ({ postId: number; endpoint?: never } | { postId?: never; endpoint: string });

export default function Poll({ postId, poll, endpoint: programEndpoint }: PollProps) {
  const fieldId = useId();
  const [results, setResults] = useState<PollResults | null>(null);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const endpoint = programEndpoint ?? `/api/posts/${postId}/polls/${encodeURIComponent(poll.id)}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke laste avstemningen. Prøv igjen.");
        return response.json() as Promise<PollResults>;
      })
      .then(setResults)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [endpoint, retry]);

  async function vote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choice || pending || !results?.open || results.canVote === false || results.selectedOption) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: choice }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kunne ikke lagre stemmen. Prøv igjen.");
      setResults(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke lagre stemmen.");
    } finally {
      setPending(false);
    }
  }

  const showResults = results && (results.selectedOption || !results.open || results.canVote === false);

  return (
    <Card className="my-8 bg-white" role="region" aria-labelledby={`${fieldId}-question`}>
      <CardHeader>
        <p className="text-xs uppercase tracking-widest text-emerald-900">Avstemning</p>
        <h2 id={`${fieldId}-question`} className="font-serif text-2xl text-stone-900">{poll.question}</h2>
      </CardHeader>
      <CardContent>
        {!results && !error && <p role="status">Laster avstemningen…</p>}
        {results && !showResults && (
          <form onSubmit={vote}>
            <fieldset disabled={pending} aria-labelledby={`${fieldId}-question`} className="space-y-3">
              {poll.options.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 text-base">
                  <input type="radio" name={fieldId} value={option.id} checked={choice === option.id} onChange={() => setChoice(option.id)} className="size-4 shrink-0 accent-emerald-800" />
                  <span className="min-w-0 break-words">{option.label}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={!choice || pending} className="mt-5 bg-emerald-800 text-white hover:bg-emerald-900">
              {pending ? "Lagrer…" : "Stem"}
            </Button>
          </form>
        )}
        {showResults && (
          <div>
            <p role="status" className="mb-5 font-medium">{!results.open ? "Avstemningen er avsluttet." : results.canVote === false ? "Resultater · besvares av husstandene" : "Takk for stemmen!"}</p>
            <ul className="!m-0 !list-none space-y-4 !p-0">
              {poll.options.map((option) => {
                const count = results.options.find((item) => item.id === option.id)?.count || 0;
                const percent = results.total ? Math.round(count / results.total * 100) : 0;
                return (
                  <li key={option.id}>
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                      <span className="break-words">{option.label}{results.selectedOption === option.id && <strong> · Ditt svar</strong>}</span>
                      <span>{count} · {percent}%</span>
                    </div>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div className="h-full rounded-full bg-emerald-700" style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-sm text-stone-600">{results.total} {results.total === 1 ? "stemme" : "stemmer"}</p>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
        {!results && error && <Button variant="outline" className="mt-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Prøv igjen</Button>}
        <p className="mt-5 text-xs text-stone-500">{programEndpoint ? "Én stemme per husstand, på tvers av enheter." : "Én stemme per nettleser."}</p>
      </CardContent>
    </Card>
  );
}
