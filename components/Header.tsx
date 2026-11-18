"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/households/LogoutButton";
import styles from "@/components/homepage/header.module.css";

const primaryLinks = [
  { href: "/", label: "Forside" },
  { href: "/program", label: "Program" },
  { href: "/news", label: "Innlegg" },
  { href: "/bilder", label: "Bilder" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function brandFromNames(names?: string) {
  const parts = (names || "Andrea & Martin")
    .split(/\s*(?:&|\bog\b|\+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}&${parts.at(-1)?.[0]}`.toUpperCase();

  const words = parts[0]?.split(/\s+/).filter(Boolean) ?? [];
  return words.length >= 2
    ? `${words[0][0]}&${words.at(-1)?.[0]}`.toUpperCase()
    : "A&M";
}

export default function Header({ names, access = "anonymous" }: { names?: string; access?: "anonymous" | "pending" | "approved" | "administrator" }) {
  const canBrowse = access === "approved" || access === "administrator";
  const links = canBrowse ? primaryLinks : [primaryLinks[0], { href: access === "pending" ? "/waiting" : "/login", label: access === "pending" ? "Venter på godkjenning" : "Logg inn" }];
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
        <Link href="/" className={styles.brand} aria-label={`${names || "Andrea og Martin"} – forside`}>
          {brandFromNames(names)}
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
