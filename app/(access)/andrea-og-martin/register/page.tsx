import { Suspense } from "react"
import { connection } from "next/server"
import RegistrationForm from "@/components/households/RegistrationForm"
import { weddingPageMetadata } from "@/features/wedding-site/branding-server"

export async function generateMetadata() {
  return weddingPageMetadata("Registrer husstanden")
}

async function RegistrationContent() {
  // Branding metadata reads current CMS settings; mark the page intentionally request-rendered.
  await connection()
  return <RegistrationForm />
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<p role="status">Laster registreringsskjemaet …</p>}>
      <RegistrationContent />
    </Suspense>
  )
}
