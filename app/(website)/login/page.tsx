import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/households/LoginForm";
import { getWebsiteViewer } from "@/features/households/auth/server";
import styles from "@/components/households/login.module.css";

export const metadata = { title: "Logg inn — Andrea & Martin", robots: { index: false, follow: false } };
async function Login() {
  const viewer = await getWebsiteViewer();
  if (viewer.administrator || viewer.household?.status === "approved") redirect("/");
  if (viewer.household) redirect("/waiting");
  return <main className={styles.page}><section className={styles.card}><h1>Velkommen tilbake</h1><p className={styles.intro}>Én innlogging for hele husstanden. Bruk husstandsnavnet og koden deres.</p><LoginForm /></section></main>;
}
export default function LoginPage() {
  return <Suspense fallback={<main className={styles.page}><p role="status">Laster innlogging …</p></main>}><Login /></Suspense>;
}
