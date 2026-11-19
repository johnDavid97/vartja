import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/households/LoginForm";
import { getWebsiteViewer } from "@/features/households/auth/server";
import styles from "@/components/households/login.module.css";
import { weddingPath } from "@/features/wedding-site/paths";
import { weddingPageMetadata } from "@/features/wedding-site/branding-server";

export async function generateMetadata() {
  return { ...await weddingPageMetadata("Logg inn"), robots: { index: false, follow: false } };
}
async function Login() {
  const viewer = await getWebsiteViewer();
  if (viewer.administrator || viewer.household?.status === "approved") redirect(weddingPath());
  if (viewer.household) redirect(weddingPath("/waiting"));
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <h1>Logg inn</h1>
        <LoginForm />
      </section>
    </main>
  );
}
export default function LoginPage() {
  return <Suspense fallback={<main className={styles.loginPage}><p role="status">Laster innlogging …</p></main>}><Login /></Suspense>;
}
