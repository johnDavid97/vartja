"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/households/LogoutButton";
import styles from "@/components/homepage/header.module.css";
import { weddingPath } from "@/features/wedding-site/paths";
import { weddingBranding } from "@/features/wedding-site/branding";

const weddingRoot = weddingPath();
const primaryLinks = [
  { href: weddingRoot, label: "Forside" },
  { href: weddingPath("/program"), label: "Program" },
  { href: weddingPath("/news"), label: "Innlegg" },
  { href: weddingPath("/bilder"), label: "Bilder" },
];

function isActive(pathname: string, href: string) {
  return href === weddingRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header({ names, access = "anonymous" }: { names?: string; access?: "anonymous" | "pending" | "approved" | "administrator" }) {
  const branding = weddingBranding(names);
  const canBrowse = access === "approved" || access === "administrator";
  const links = canBrowse ? primaryLinks : [primaryLinks[0], { href: weddingPath(access === "pending" ? "/waiting" : "/login"), label: access === "pending" ? "Venter på godkjenning" : "Logg inn" }];
  const accountControl = access === "administrator" ? <Link href="/admin" className={styles.link}>Administrasjon</Link> : access !== "anonymous" ? <LogoutButton /> : null;
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const navLink = ({ href, label }: (typeof primaryLinks)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={active ? `${styles.link} ${styles.active}` : styles.link}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={weddingRoot} className={styles.brand} aria-label={`${branding.names} – forside`}>
          {branding.monogram}
        </Link>

        <nav className={styles.desktopNav} aria-label="Hovedmeny">
          {links.map(navLink)}
          {accountControl}
        </nav>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={styles.menuButton}
          ref={menuButton}
          aria-expanded={menuOpen}
          aria-controls={navigationId}
          aria-label={menuOpen ? "Lukk meny" : "Åpne meny"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      {menuOpen && (
        <nav id={navigationId} className={styles.mobileNav} aria-label="Hovedmeny">
          {links.map(navLink)}
          {accountControl}
        </nav>
      )}
    </header>
  );
}
