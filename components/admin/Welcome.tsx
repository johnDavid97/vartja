import Link from "next/link";

export default function Welcome() {
  return (
    <section className="wedding-dashboard">
      <p className="wedding-dashboard__eyebrow">Deres bryllupsnettside</p>
      <h1>Velkommen, Andrea &amp; Martin</h1>
      <p>Her kan dere oppdatere nettsiden og dele nyheter med gjestene.</p>
      <div className="wedding-dashboard__actions">
        <Link href="/admin/collections/posts/create">Skriv et innlegg</Link>
        <Link href="/admin/globals/wedding">Endre bryllupsinformasjon</Link>
        <a href="/" target="_blank" rel="noopener noreferrer">Se nettsiden ↗</a>
      </div>
      <p className="wedding-dashboard__hint">
        Innlegg: fyll inn tittel og beskrivelse, legg til et bilde om dere vil, og trykk Publiser endringer.
        Lagre utkast lagrer uten å vise innlegget til gjestene.
        Publiserte endringer vises når nettsiden åpnes eller oppdateres.
      </p>
    </section>
  );
}
