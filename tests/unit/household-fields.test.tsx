import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { HouseholdContactFields, MemberListFields } from "@/components/households"

function inputWithName(html: string, name: string): string {
  return html.match(/<input[^>]*>/g)?.find((input) => input.includes(`name="${name}"`)) ?? ""
}

describe("household fields", () => {
  it("associates contact labels and field-specific errors with named inputs", () => {
    const html = renderToStaticMarkup(
      <HouseholdContactFields
        value={{ contactName: "Ola Nordmann", email: "ugyldig" }}
        onChange={vi.fn()}
        errors={{ contactName: "Skriv inn kontaktpersonens navn", email: "Skriv inn en gyldig e-postadresse" }}
      />,
    )

    const contactInput = inputWithName(html, "contactName")
    const emailInput = inputWithName(html, "email")
    const contactId = contactInput.match(/\sid="([^"]+)"/)?.[1]
    const emailId = emailInput.match(/\sid="([^"]+)"/)?.[1]

    expect(contactId).toBeTruthy()
    expect(emailId).toBeTruthy()
    expect(html).toMatch(new RegExp(`<label[^>]*for="${contactId}"`))
    expect(html).toMatch(new RegExp(`<label[^>]*for="${emailId}"`))
    expect(emailInput).toContain('type="email"')
    expect(contactInput).toContain('aria-invalid="true"')
    expect(contactInput).toMatch(/aria-describedby="[^"]+-error"/)
    expect(emailInput).toContain('aria-invalid="true"')
    expect(emailInput).toMatch(/aria-describedby="[^"]+-error"/)
    expect(html).toContain("Skriv inn kontaktpersonens navn")
    expect(html).toContain("Skriv inn en gyldig e-postadresse")
  })

  it("renders clearly named family-member inputs without implying an RSVP", () => {
    const html = renderToStaticMarkup(
      <MemberListFields
        value={[{ rowKey: "row-1", id: "member-1", name: "Ola" }, { rowKey: "row-2", name: "Kari" }]}
        onChange={vi.fn()}
        errors={[undefined, "Skriv inn deltakerens navn"]}
      />,
    )

    expect(html).toContain("også kontaktpersonen")
    expect(html).toContain("Registrering av husstanden er ikke et svar på invitasjonen")
    expect(html).toContain('name="members.0.name"')
    expect(html).toContain('name="members.1.name"')
    expect(html).toContain("Navn på familiemedlem 1")
    expect(html).toContain("Navn på familiemedlem 2")
    const invalidMemberInput = inputWithName(html, "members.1.name")
    expect(invalidMemberInput).toContain('aria-invalid="true"')
    expect(invalidMemberInput).toMatch(/aria-describedby="[^"]+-error"/)
    expect(html).toContain("Skriv inn deltakerens navn")
    expect(html.match(/<button[^>]*type="button"/g)).toHaveLength(3)
  })

  it("can show the contact as a locked first member without changing the default controls", () => {
    const html = renderToStaticMarkup(
      <MemberListFields
        value={[{ rowKey: "contact", name: "Ola" }, { rowKey: "row-2", name: "Kari" }]}
        onChange={vi.fn()}
        firstMemberLocked
        description="Legg til de andre i husstanden."
      />,
    )

    expect(html).toContain("Kontaktperson (familiemedlem 1)")
    expect(html).toContain("Legg til de andre i husstanden.")
    expect(html).not.toContain('name="members.0.name"')
    expect(html).toContain('name="members.1.name"')
    const removeButtons = html.match(/<button[^>]*>Fjern<\/button>/g) ?? []
    expect(removeButtons[0]).toContain('disabled=""')
    expect(removeButtons[1]).not.toContain('disabled=""')
  })

  it("disables contact inputs and all member editing controls", () => {
    const contactHtml = renderToStaticMarkup(
      <HouseholdContactFields
        value={{ contactName: "Ola", email: "ola@example.no" }}
        onChange={vi.fn()}
        disabled
      />,
    )
    const membersHtml = renderToStaticMarkup(
      <MemberListFields value={[{ rowKey: "row-1", id: "member-1", name: "Ola" }]} onChange={vi.fn()} disabled />,
    )

    expect(contactHtml).toMatch(/<fieldset[^>]*disabled=""/)
    expect(contactHtml.match(/<input[^>]*disabled=""/g)).toHaveLength(2)
    expect(membersHtml).toMatch(/<fieldset[^>]*disabled=""/)
    expect(membersHtml).toMatch(/<input[^>]*disabled=""/)
    expect(membersHtml.match(/<button[^>]*disabled=""/g)).toHaveLength(2)
  })

  it("disables adding at the configured member limit without disabling removal", () => {
    const html = renderToStaticMarkup(
      <MemberListFields value={[{ rowKey: "row-1", name: "Ola" }, { rowKey: "row-2", name: "Kari" }]} onChange={vi.fn()} maxMembers={2} />,
    )

    const removeButton = html.match(/<button[^>]*>Fjern<\/button>/)?.[0] ?? ""
    const addButton = html.match(/<button[^>]*>Legg til familiemedlem<\/button>/)?.[0] ?? ""
    expect(removeButton).toContain('aria-label="Fjern familiemedlem 1: Ola"')
    expect(removeButton).not.toContain('disabled=""')
    expect(addButton).toContain('disabled=""')
    expect(html).toContain("2 av 2 familiemedlemmer lagt til")
  })

  it("prevents removing the final family member", () => {
    const html = renderToStaticMarkup(
      <MemberListFields value={[{ rowKey: "row-1", name: "Ola" }]} onChange={vi.fn()} />,
    )
    expect(html.match(/<button[^>]*>Fjern<\/button>/)?.[0]).toContain('disabled=""')
  })

  it.each([0, -1, 1.5, 51, Number.NaN])("rejects an inconsistent member limit %s", (maxMembers) => {
    expect(() => renderToStaticMarkup(
      <MemberListFields value={[]} onChange={vi.fn()} maxMembers={maxMembers} />,
    )).toThrow(RangeError)
  })
})
