import { Suspense } from "react"

import RegistrationForm from "@/components/households/RegistrationForm"

export default function RegistrationPage() {
  return (
    <Suspense fallback={<p role="status">Laster registreringsskjemaet …</p>}>
      <RegistrationForm />
    </Suspense>
  )
}
