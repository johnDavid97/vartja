"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { HouseholdIdentity } from "@/components/households/HouseholdIdentity";
import type { CommentInput, CommentPage, CommentView } from "@/features/comments/validation";
import styles from "./comments.module.css";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
function mergeComments(previous: CommentView[], incoming: CommentView[]) {
  const merged = new Map(previous.map((comment) => [comment.id, comment]));
  incoming.forEach((comment) => merged.set(comment.id, comment));
  return [...merged.values()].sort((a, b) => a.id - b.id);
}

interface CommentsProps { endpoint: string; authorName: string; administrator: boolean }

/** Reset state between targets, while Program's visited panels preserve their own mounted instance. */
export function Comments(props: CommentsProps) {
  return <CommentThread key={props.endpoint} {...props} />;
}

function CommentThread({ endpoint, authorName, administrator }: CommentsProps) {
  const id = useId();
  const [comments, setComments] = useState<CommentView[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const snapshot = useRef<CommentInput | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Kunne ikke laste kommentarene.");
      return response.json() as Promise<CommentPage>;
    }).then((page) => {
      setComments(page.comments); setCursor(page.nextCursor); setEnabled(page.enabled); setLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setError("Kunne ikke laste kommentarene. Prøv igjen."); });
    return () => controller.abort();
  }, [endpoint, reload]);

  async function more() {
    if (cursor === null || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint}?after=${cursor}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Kunne ikke laste flere kommentarer.");
      const page: CommentPage = await response.json();
      setComments((previous) => mergeComments(previous, page.comments)); setCursor(page.nextCursor); setEnabled(page.enabled);
    } catch { setError("Kunne ikke laste flere kommentarer. Prøv igjen."); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !body.trim()) return;
    setPending(true); setError(""); setNotice("");
    snapshot.current ??= { requestKey: crypto.randomUUID(), body, parentId };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot.current) });
      if (!response.ok) {
        if (response.status < 500) { snapshot.current = null; setUncertain(false); }
        const result = await response.json();
        throw new Error(result.error || "Kunne ikke sende kommentaren.");
      }
      const comment: CommentView = await response.json();
      setComments((previous) => mergeComments(previous, [comment])); setBody(""); setParentId(null);
      snapshot.current = null; setUncertain(false); setNotice("Kommentaren er lagt til.");
    } catch (cause) {
      setUncertain(snapshot.current !== null);
      setError(cause instanceof Error ? cause.message : "Kunne ikke sende kommentaren.");
    } finally { setPending(false); }
  }
  async function moderate(comment: CommentView) {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comment.id, status: comment.hidden ? "published" : "hidden" }) });
      if (!response.ok) throw new Error();
      const updated: CommentView = await response.json();
      setComments((previous) => mergeComments(previous, [updated]));
    } catch { setError("Kunne ikke endre synlighet. Prøv igjen."); }
    finally { setPending(false); }
  }
  function replyRoot(comment: CommentView) {
    const root = comments.find((candidate) => candidate.id === (comment.parentId ?? comment.id));
    return root && !root.hidden && root.parentId === null ? root : null;
  }
  function reply(comment: CommentView) {
    const root = replyRoot(comment);
    if (pending || uncertain || comment.hidden || !root) return;
    setParentId(root.id); textarea.current?.focus();
  }
  function renderComment(comment: CommentView) {
    const canReply = enabled && !comment.hidden && replyRoot(comment) !== null;
    return <article className={styles.comment} key={comment.id}>
      {comment.hidden ? <p className={styles.hidden}>Kommentaren er skjult av brudeparet.</p> : <>
        <HouseholdIdentity name={comment.authorName} administrator={comment.administrator} />
        <p className={styles.body}>{comment.body}</p>
      </>}
      <div className={styles.actions}>
        <time dateTime={comment.createdAt}>{dateFormatter.format(new Date(comment.createdAt))}</time>
        {canReply && <button type="button" disabled={pending || uncertain} onClick={() => reply(comment)}>Svar</button>}
        {administrator && <button type="button" disabled={pending} onClick={() => moderate(comment)}>{comment.hidden ? "Vis kommentar" : "Skjul kommentar"}</button>}
      </div>
    </article>;
  }
  const replyTarget = comments.find((comment) => comment.id === parentId);
  return <section className={styles.section} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Kommentarer</h2>
    {!loaded && !error && <p role="status">Laster kommentarer …</p>}
    {loaded && comments.length === 0 && <p className={styles.hint}>Ingen kommentarer ennå. Har dere noen spørsmål?</p>}
    {comments.filter((comment) => comment.parentId === null).map((root) => <div className={styles.thread} key={root.id}>
      {renderComment(root)}
      <div className={styles.replies}>{comments.filter((comment) => comment.parentId === root.id).map(renderComment)}</div>
    </div>)}
    {cursor !== null && <button className={styles.secondary} type="button" disabled={loading} onClick={more}>{loading ? "Laster …" : "Vis flere kommentarer"}</button>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!loaded && error && <button type="button" className={styles.secondary} onClick={() => { setError(""); setReload((value) => value + 1); }}>Prøv igjen</button>}
    {loaded && !enabled && <p className={styles.hint}>Kommentarer er stengt her.</p>}
    {loaded && enabled && <form onSubmit={submit} className={styles.composer}>
      <HouseholdIdentity name={authorName} administrator={administrator} />
      {replyTarget && <p className={styles.hint}>Svar til {replyTarget.authorName || "kommentaren"} <button type="button" disabled={pending || uncertain} onClick={() => setParentId(null)}>Avbryt svar</button></p>}
      <label htmlFor={`${id}-body`} className="sr-only">{parentId ? "Skriv et svar" : "Legg til en kommentar"}</label>
      <textarea ref={textarea} id={`${id}-body`} value={body} maxLength={2000} rows={2} placeholder={parentId ? "Skriv et svar …" : "Legg til en kommentar …"} disabled={pending || uncertain} onChange={(event) => setBody(event.target.value)} />
      {uncertain && <p className={styles.hint}>Kommentaren kan ha blitt lagret. Prøv igjen med samme tekst for å unngå dobbelt innsending.</p>}
      <button className={styles.submit} type="submit" disabled={pending || !body.trim()}>{pending ? "Sender …" : uncertain ? "Prøv igjen" : parentId ? "Send svar" : "Kommenter"}</button>
    </form>}
    {notice && <p role="status" className={styles.hint}>{notice}</p>}
  </section>;
}
