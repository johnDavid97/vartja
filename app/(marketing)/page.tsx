import Link from "next/link";
import styles from "./landing.module.css";

const features = [
  { number: "01", title: "En side som føles som dere", text: "Deres navn, deres farger og deres ord. En personlig ramme rundt dagen dere gleder dere til å dele." },
  { number: "02", title: "Det praktiske, på ett sted", text: "Fra vielse til siste dans. Samle program, steder og nyttig informasjon, så gjestene vet hva som skjer." },
  { number: "03", title: "Hold gjestene oppdatert", text: "Del små og store nyheter underveis. Med innlegg, kommentarer og avstemninger blir det enkelt å holde kontakten." },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header id="toppen" tabIndex={-1} className={styles.header}>
        <Link className={styles.wordmark} href="/" prefetch={false} aria-label="VårtJa – forsiden">VårtJa<span aria-hidden="true">.</span></Link>
        <nav aria-label="Hovedmeny" className={styles.nav}>
          <a href="#muligheter">Dette får dere</a>
          <a href="#gjestene">For gjestene <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="hovedinnhold" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>PERSONLIGE BRYLLUPSNETTSIDER</p>
            <h1 id="hero-heading">Et stort ja.<br />Et helt eget <em>sted.</em></h1>
            <p className={styles.lead}>Vi lager bryllupsnettsider som samler dagen, detaljene og menneskene dere er glade i.</p>
            <a className={styles.button} href="#muligheter">Se mulighetene <span aria-hidden="true">↓</span></a>
            <p className={styles.smallNote}>Laget med omtanke. For dere og gjestene deres.</p>
          </div>
          <figure className={styles.preview}>
            <div className={styles.previewArt} aria-hidden="true">
              <div className={styles.orbit} />
              <div className={styles.paper}>
                <span className={styles.paperLabel}>VI GIFTER OSS</span>
                <span className={styles.paperTitle}>Deres<br /><em>store dag.</em></span>
                <span className={styles.paperHeart}>♡</span>
                <span className={styles.paperRule} />
                <span className={styles.paperCaption}>Og alle de små øyeblikkene.</span>
              </div>
              <div className={styles.programCard}>
                <span className={styles.programTitle}>En dag å glede seg til</span>
                <span><b>14:00</b> Vi sier ja</span>
                <span><b>17:00</b> Til bords</span>
                <span><b>21:00</b> Ut på dansegulvet</span>
              </div>
              <span className={styles.seal}>VJ</span>
            </div>
            <figcaption>En liten illustrasjon av den store dagen.</figcaption>
          </figure>
        </section>

        <section id="muligheter" className={styles.features} aria-labelledby="features-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>MINDRE LETING. MER GLEDE.</p>
            <h2 id="features-heading">Alt det viktige.<br /><em>Samlet med omtanke.</em></h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article className={styles.feature} key={feature.number}>
                <span className={styles.number} aria-hidden="true">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="gjestene" className={styles.guests} aria-labelledby="guests-heading">
          <div>
            <p className={styles.eyebrow}>ENKELT Å DELE. GODT Å HA.</p>
            <h2 id="guests-heading">En del av feiringen,<br /><em>allerede før dagen.</em></h2>
          </div>
          <div className={styles.guestCopy}>
            <p>Invitasjonen viser vei. Gjestene finner nettsiden via en lenke eller QR-kode, og logger inn med husstandens navn og kode for å se innholdet som er for dem.</p>
            <p>Dere får et eget sted for informasjonen. Gjestene får en enkel måte å følge med på – også fra mobilen.</p>
            <aside className={styles.invited}>
              <h3>Er du invitert i et bryllup?</h3>
              <p>Bruk lenken eller QR-koden du har fått fra brudeparet. Hvert bryllup har sin egen adresse.</p>
            </aside>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span className={styles.wordmark}>VårtJa<span aria-hidden="true">.</span></span>
        <p>For et ja. Og alt som hører til.</p>
        <a href="#toppen">Til toppen <span aria-hidden="true">↑</span></a>
      </footer>
    </div>
  );
}
