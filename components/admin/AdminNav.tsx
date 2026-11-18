"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useNav } from "@payloadcms/ui";
import { AdminButton, adminButtonStyles } from "./AdminButton";
import { useHouseholdSummary } from "./households/useHouseholdSummary";
import householdStyles from "./households/household-workspace.module.css";
import { BarChart3, Clock3, ExternalLink, FileText, Home, ImageIcon, LogOut, MessageCircle, Settings2, Users, X } from "lucide-react";

export default function AdminNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { navOpen, setNavOpen, navRef } = useNav();
  const { summary: householdSummary } = useHouseholdSummary();
  const name = user?.name || user?.email || "Redaktør";
  const initials = name.split(/\s+/).slice(0, 2).map((word: string) => word[0]).join("").toUpperCase();
  const closeOnMobile = () => { if (window.matchMedia("(max-width: 1024px)").matches) setNavOpen(false); };
  const active = (href: string) => pathname.startsWith(href.split("?")[0]);
  const link = (href: string, label: string, Icon: typeof FileText, trailing?: React.ReactNode) => (
    <Link href={href} className="wedding-nav__item" aria-current={active(href) ? "page" : undefined} onClick={closeOnMobile}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>{trailing}
    </Link>
  );

  return (
    <aside className={`nav wedding-nav${navOpen ? " wedding-nav--open" : ""}`} ref={navRef} onKeyDown={(event) => {
      if (event.key === "Escape" && window.matchMedia("(max-width: 1024px)").matches) {
        setNavOpen(false);
        document.querySelector<HTMLButtonElement>(".template-default__nav-toggler")?.focus();
      }
    }}>
      <Link href="/admin" className="wedding-nav__brand" onClick={closeOnMobile}>
        <span className="wedding-monogram">A&amp;M</span>
        <span><strong>Andrea &amp; Martin</strong><small>Bryllupsside · admin</small></span>
      </Link>
      <AdminButton variant="ghost" size="icon-sm" className="wedding-nav__close" aria-label="Lukk meny" onClick={() => setNavOpen(false)}><X size={20} /></AdminButton>
      <nav aria-label="Administrasjon" className="wedding-nav__links">
        <h2>Brukere og admin</h2>
        {link("/admin/collections/households?tab=overview", "Husstander", Home, householdSummary ? (
          <span className={householdStyles.navBadge} aria-label={`${householdSummary.pending} ventende husstander`}>
            {householdSummary.pending}
          </span>
        ) : undefined)}
        {link("/admin/collections/users", "Administratorer", Users)}
        <h2>Sider</h2>
        {link("/admin/collections/posts", "Innlegg", FileText)}
        {link("/admin/globals/program", "Program", Clock3)}
        {link("/admin/collections/media", "Bilder", ImageIcon)}
        <h2>Aktivitet</h2>
        {link("/admin/polls", "Avstemninger", BarChart3)}
        {link("/admin/collections/program-comments", "Kommentarer", MessageCircle)}
        <div className="wedding-nav__settings">{link("/admin/globals/wedding", "Innstillinger", Settings2)}</div>
      </nav>
      <footer className="wedding-nav__footer">
        <a className={adminButtonStyles({ variant: "secondary", className: "wedding-nav__website" })} href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true" />Se nettsiden</a>
        <div className="wedding-nav__account">
          <Link href="/admin/account" onClick={closeOnMobile}><span className="wedding-avatar">{initials}</span><span><strong>{name}</strong><small>Redaktør</small></span></Link>
          <Link className={adminButtonStyles({ variant: "ghost", size: "icon-sm" })} href="/admin/logout" aria-label="Logg ut" title="Logg ut"><LogOut size={19} /></Link>
        </div>
      </footer>
    </aside>
  );
}
