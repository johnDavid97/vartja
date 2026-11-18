"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import styles from "./login.module.css";

export default function LoginForm() {
  const [showCode, setShowCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/household-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdName: data.get("householdName"), accessCode: data.get("accessCode"), remember: data.get("remember") === "on" }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Kunne ikke logge inn. Prøv igjen.";
        setError(message); setPending(false); return;
      }
      // No tokens or codes in browser storage or URLs. Reset authenticated route caches.
      const household = result && typeof result === "object" && "household" in result ? result.household : null;
      if (!household || typeof household !== "object" || !("status" in household) || !["pending", "approved"].includes(String(household.status))) throw new Error("Invalid response");
      window.location.assign(household.status === "pending" ? "/waiting" : "/");
    } catch {
      setError("Kunne ikke koble til. Sjekk forbindelsen og prøv igjen.");
      setPending(false);
    }
  }
  return <form onSubmit={submit} className={styles.form}>
    <fieldset disabled={pending} className={styles.fields}>
      <label htmlFor="household-login-name">Husstandsnavn</label>
      <input id="household-login-name" name="householdName" autoComplete="username" required maxLength={120} placeholder="For eksempel Aud og Erik" aria-describedby="household-name-hint" />
      <p id="household-name-hint" className={styles.hint}>Bruk navnet dere valgte ved registrering, eller fikk fra brudeparet.</p>
      <label htmlFor="household-login-code">Husstandskode</label>
      <div className={styles.codeRow}><input id="household-login-code" name="accessCode" type={showCode ? "text" : "password"} autoComplete="current-password" autoCapitalize="characters" spellCheck={false} required maxLength={100} aria-describedby="household-code-hint" /><Button variant="outline" type="button" aria-controls="household-login-code" aria-pressed={showCode} onClick={() => setShowCode(!showCode)}>{showCode ? "Skjul" : "Vis kode"}</Button></div>
      <p id="household-code-hint" className={styles.hint}>Du kan lime inn koden. Store eller små bokstaver og bindestreker spiller ingen rolle.</p>
      <label className={styles.remember}><input type="checkbox" name="remember" defaultChecked />Husk meg på denne enheten</label>
      <p className={styles.hint}>I opptil 12 måneder. Fjern haken på en delt eller offentlig enhet.</p>
      <Button type="submit" disabled={pending} className={styles.submit}>{pending ? "Logger inn …" : "Logg inn"}</Button>
    </fieldset>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <p className={styles.help}>Glemt navn eller kode? Ta kontakt med brudeparet, så hjelper vi dere. Automatisk gjenoppretting på e-post kommer senere.</p>
  </form>;
}
