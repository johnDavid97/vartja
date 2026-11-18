"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SetStepNav } from "@payloadcms/ui";
import { BarChart3, RefreshCw, X } from "lucide-react";
import type { PollOverviewRow } from "@/features/polls/overview";
import { AdminButton, adminButtonStyles } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/tables/AdminTable";
import styles from "./poll-overview.module.css";

const statuses = {
  open: { label: "Åpen", className: "published" },
  closed: { label: "Avsluttet", className: "private" },
  draft: { label: "Utkast", className: "draft" },
  archived: { label: "Arkivert", className: "private" },
} as const;
const pageSize = 20;

export default function PollOverview({ rows }: { rows: PollOverviewRow[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = rows.find((row) => row.key === selectedKey);
  const filtered = rows.filter((row) => (status === "all" || row.status === status)
    && `${row.question} ${row.postTitle}`.toLocaleLowerCase("nb").includes(search.trim().toLocaleLowerCase("nb")));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);

  return (
    <div className={styles.workspace}>
      <SetStepNav nav={[{ label: "Avstemninger" }]} />
      <header className={styles.header}>
        <div><h1>Avstemninger</h1><p>Spørsmålene deres, samlet på ett sted.</p></div>
        <AdminButton variant="secondary" loading={refreshing} disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}><RefreshCw size={16} aria-hidden="true" />Oppdater</AdminButton>
      </header>
      <p className={styles.hint}>Avstemninger opprettes og redigeres i innlegg. Publiserte innstillinger vises her; upubliserte avstemninger er merket Utkast. Stemmer telles per nettleser, ikke per husstand.</p>
      <div className={styles.toolbar}>
        <label>Søk i avstemninger<input type="search" value={search} placeholder="Spørsmål, innlegg eller programdag" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <div className={styles.statusFilter}><label htmlFor="poll-overview-status">Status</label><select id="poll-overview-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Alle statuser</option>{Object.entries(statuses).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></div>
        <span role="status">{filtered.length} avstemninger</span>
      </div>
      {visible.length ? <AdminTable label="Avstemninger"><table>
        <thead><tr><th scope="col">Spørsmål</th><th scope="col">Innlegg / programdag</th><th scope="col">Status</th><th scope="col">Stemmer</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={row.key}>
          <td className={`admin-table-title ${styles.question}`}><button type="button" onClick={() => setSelectedKey(row.key)} aria-haspopup="dialog">{row.question}</button><span className="admin-table-title__description">Se resultater{row.hasDraftChanges ? " · Endringer i utkast" : ""}</span></td>
          <td><Link href={row.editorHref ?? `/admin/collections/posts/${row.postId}`}>{row.postTitle}</Link>{row.private ? <span className="admin-table-title__description">Privat · bare redaktører</span> : null}</td>
          <td><span className={`admin-table-status admin-table-status--${statuses[row.status].className}`}>{statuses[row.status].label}</span></td>
          <td>{row.total}</td>
        </tr>)}</tbody>
      </table></AdminTable> : <section className={styles.empty}><BarChart3 size={32} aria-hidden="true" /><h2>{rows.length ? "Ingen treff" : "Ingen avstemninger ennå"}</h2><p>{rows.length ? "Prøv et annet søk eller en annen status." : "Legg til en avstemning i et innlegg eller på en programdag for å se den her. Ufullstendige utkast vises når spørsmål og svar er fylt ut."}</p><Link href="/admin/collections/posts" className={adminButtonStyles({ variant: "secondary" })}>Gå til innlegg</Link></section>}
      <footer className={styles.pagination}><span>Side {currentPage} av {pages}</span><AdminButton variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Forrige</AdminButton><AdminButton variant="secondary" size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Neste</AdminButton></footer>
      <dialog ref={dialog} className={styles.results} aria-labelledby="poll-results-title" onClose={() => setSelectedKey(null)}>
        {selected && <>
          <header className={styles.resultHeader}><h2 id="poll-results-title">{selected.question}</h2><AdminButton variant="ghost" size="icon-sm" aria-label="Lukk resultater" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></AdminButton></header>
          <p>{selected.total} stemmer · {statuses[selected.status].label}</p>
          {selected.status === "archived" ? <p>Fjernet fra innlegget. Tidligere stemmer er bevart.</p> : null}
          {selected.hasDraftChanges ? <p>Innholdet har upubliserte endringer for denne avstemningen. Resultatene gjelder den publiserte versjonen.</p> : null}
          {selected.private ? <p>Privat innlegg – bare redaktører har tilgang.</p> : null}
          {!selected.total ? <p>Ingen stemmer ennå.</p> : null}
          <ul className={styles.options}>{selected.options.map((option) => {
            const percent = selected.total ? Math.round(option.count / selected.total * 100) : 0;
            return <li key={option.id}><div><strong>{option.label}</strong><span>{option.count} stemmer · {percent} %</span></div><progress max={selected.total || 1} value={option.count} aria-label={`${option.label}: ${option.count} av ${selected.total} stemmer`} /></li>;
          })}</ul>
          <Link href={selected.editorHref ?? `/admin/collections/posts/${selected.postId}`} className={adminButtonStyles({ variant: "secondary" })}>{selected.editorHref ? "Rediger i Program" : "Rediger i innlegget"}</Link>
        </>}
      </dialog>
    </div>
  );
}
