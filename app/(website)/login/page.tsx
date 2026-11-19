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
