import { getPayload } from "payload";
import config from "@payload-config";
import QRCode from "qrcode";
import { getHouseholdRegistrationServices } from "@/features/households/composition-root";
import { buildInvitationUrl } from "@/features/households/domain/invitation-url";
import { requireHouseholdAdministrator } from "@/features/households/http/administrator";
import { householdErrorResponse, householdResponse, readHouseholdRequest } from "@/features/households/http/requests";

export async function POST(request: Request) {
  try {
    await readHouseholdRequest(request, 1024);
    const payload = await getPayload({ config });
    await requireHouseholdAdministrator(payload, request.headers);
    const { invitation } = getHouseholdRegistrationServices(payload);
    const registrationUrl = buildInvitationUrl({
      requestUrl: request.url,
      publicSiteUrl: process.env.PUBLIC_SITE_URL,
      invitationKey: invitation.getKey(),
    });
    const qrOptions = { errorCorrectionLevel: "M", margin: 4, width: 512 } as const;
    const [qrDataUrl, qrSvg] = await Promise.all([
      QRCode.toDataURL(registrationUrl, qrOptions),
      QRCode.toString(registrationUrl, { ...qrOptions, type: "svg" }),
    ]);
    return householdResponse({ registrationUrl, qrDataUrl, qrSvg });
  } catch (error) {
    return householdErrorResponse(error);
  }
}
