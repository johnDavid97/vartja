import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getWebsiteViewer } from "@/features/households/auth/server";
import CheckApprovalButton from "@/components/households/CheckApprovalButton";
import LogoutButton from "@/components/households/LogoutButton";
import styles from "@/components/households/login.module.css";

export const metadata = { title: "Venter på godkjenning — Andrea & Martin", robots: { index: false, follow: false } };
async function Waiting() {
  const viewer = await getWebsiteViewer();
  if (viewer.administrator || viewer.household?.status === "approved") redirect("/");
  if (!viewer.household) redirect("/login");
  return <main className={styles.page}><section className={styles.card}><h1>Venter på godkjenning</h1><p className={styles.intro}>Hei, {viewer.household.displayName}! Registreringen deres er mottatt. Brudeparet må godkjenne husstanden før dere kan se innlegg, program og bilder.</p><p>Dere trenger ikke registrere dere på nytt. Sjekk gjerne igjen senere, eller ta kontakt med brudeparet.</p><div className={styles.actions}><CheckApprovalButton /><LogoutButton /></div></section></main>;
}
export default function WaitingPage() {
  return <Suspense fallback={<main className={styles.page}><p role="status">Sjekker status …</p></main>}><Waiting /></Suspense>;
}
