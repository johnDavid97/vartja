import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { invitationKeyFromFragment, RegistrationSuccess } from "@/components/households/RegistrationForm"
import { weddingPath } from "@/features/wedding-site/paths"

describe("household registration form presentation", () => {
  it("accepts only one long opaque invitation value in the fragment", () => {
    const invitationKey = "aB3_-opaqueInvitationKeyThatIsLongEnough_123456"

    expect(invitationKeyFromFragment(`#invitation=${invitationKey}`)).toBe(invitationKey)
    expect(invitationKeyFromFragment("#invitation=short")).toBeNull()
    expect(invitationKeyFromFragment(`#invitation=${invitationKey}&other=value`)).toBeNull()
    expect(invitationKeyFromFragment(`#invitation=${invitationKey}&invitation=${invitationKey}`)).toBeNull()
    expect(invitationKeyFromFragment(`?invitation=${invitationKey}`)).toBeNull()
  })

  it("presents the returned code and accurately explains pending access", () => {
    const html = renderToStaticMarkup(<RegistrationSuccess accessCode="FAMILIE-7K9P" />)

    expect(html).toContain("Husstanden er registrert")
    expect(html).toContain("FAMILIE-7K9P")
    expect(html).toContain("venter på godkjenning")
    expect(html).toContain("Kopier koden")
    expect(html).toContain("Skriv ut")
    expect(html).toContain("Bruk husstandsnavnet og koden for å logge inn")
    expect(html).toContain(`href="${weddingPath("/login")}"`)
    expect(html).not.toContain("privat nettside")
  })
})
