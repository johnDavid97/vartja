import { describe, expect, it } from "vitest"

import {
  parseHouseholdInvitationDetails,
  presentHouseholdInvitation,
} from "@/lib/household-invitation-presentation"

const validResponse = {
  registrationUrl: "https://preview.example/register#invitation=inv_test-only-token&source=card",
  qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
}

describe("household invitation presentation", () => {
  it("masks only the invitation key while retaining the actual URL for use", () => {
    const details = parseHouseholdInvitationDetails(validResponse)
    expect(details?.registrationUrl).toBe(validResponse.registrationUrl)
    expect(presentHouseholdInvitation(validResponse.registrationUrl).maskedUrl).toBe(
      `https://preview.example/register#invitation=${"•".repeat(12)}&source=card`,
    )
  })

  it.each([
    "http://localhost:3000/register#invitation=test",
    "http://127.24.0.1:3000/register#invitation=test",
    "http://[::1]:3000/register#invitation=test",
  ])("warns for an actual local or loopback hostname: %s", (registrationUrl) => {
    expect(presentHouseholdInvitation(registrationUrl).isLocal).toBe(true)
  })

  it("does not describe a preview or public hostname as local", () => {
    expect(presentHouseholdInvitation(validResponse.registrationUrl)).toMatchObject({
      host: "preview.example",
      isLocal: false,
    })
  })

  it.each([
    { ...validResponse, registrationUrl: "javascript:alert(1)#invitation=test" },
    { ...validResponse, registrationUrl: "not a URL" },
    { ...validResponse, registrationUrl: "https://example.test/register" },
    { ...validResponse, qrDataUrl: "https://external.example/qr.png" },
    { ...validResponse, qrSvg: '<svg onload="alert(1)"></svg>' },
  ])("rejects an unsafe or malformed server response", (response) => {
    expect(parseHouseholdInvitationDetails(response)).toBeNull()
  })
})
