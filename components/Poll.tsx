"use client";

import { useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { PollDefinition, PollResults } from "@/lib/polls";
import styles from "./poll.module.css";

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
    <section className={styles.poll} role="region" aria-labelledby={`${fieldId}-question`}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 14V9m5 5V4m5 10V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <h2 id={`${fieldId}-question`} className={styles.question}>{poll.question}</h2>
      </header>

      {!results && !error && <p role="status" className={styles.loading}>Laster avstemningen…</p>}
      {results && !showResults && (
        <form onSubmit={vote}>
          <fieldset disabled={pending} aria-labelledby={`${fieldId}-question`} className={styles.options}>
            {poll.options.map((option) => (
              <label key={option.id} className={styles.option}>
                <input
                  type="radio"
                  name={fieldId}
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => setChoice(option.id)}
                  className={styles.radio}
                />
                <span className={styles.optionLabel}>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={!choice || pending} className={styles.submit}>
            {pending ? "Lagrer…" : "Stem"}
          </Button>
        </form>
      )}
      {showResults && (
        <div>
          <p role="status" className={styles.status}>
            {!results.open ? "Avstemningen er avsluttet." : results.canVote === false ? "Resultater · besvares av husstandene" : "Takk for stemmen!"}
          </p>
          <ul className={styles.results}>
            {poll.options.map((option) => {
              const count = results.options.find((item) => item.id === option.id)?.count || 0;
              const percent = results.total ? Math.round(count / results.total * 100) : 0;
              return (
                <li key={option.id} className={styles.resultRow}>
                  <span className={styles.resultFill} style={{ "--result-width": `${percent}%` } as CSSProperties} aria-hidden="true" />
                  <span className={styles.resultLabel}>
                    {option.label}
                    {results.selectedOption === option.id && <strong className={styles.selectedMarker}> · Ditt svar</strong>}
                  </span>
                  <span className={styles.resultCount}>{count} {count === 1 ? "stemme" : "stemmer"} · {percent} %</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.total}>{results.total} {results.total === 1 ? "stemme" : "stemmer"}</p>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!results && error && (
        <Button variant="outline" className={styles.retry} onClick={() => { setError(""); setRetry((value) => value + 1); }}>
          Prøv igjen
        </Button>
      )}
      <p className={styles.helper}>{programEndpoint ? "Én stemme per husstand, på tvers av enheter." : "Én stemme per nettleser."}</p>
    </section>
  );
}
