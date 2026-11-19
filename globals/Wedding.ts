import type { GlobalConfig } from "payload";
import { canReadGuestContent } from "../features/households/auth/access";
import { DEFAULT_HERO_COLOR } from "../features/homepage/settings";
import { isHexColor } from "../lib/colors";

export const Wedding: GlobalConfig = {
  slug: "wedding",
  label: "Bryllupsinformasjon",
  admin: {
    group: "Bryllupet",
    description: "Tilpass den offentlige forsiden: navn, dato, sted, tekster og bilde eller bakgrunnsfarge. Dagsprogrammet redigeres under Program.",
  },
  access: {
    // Homepage settings are public; legacy guest-only fields have their own access checks.
    read: () => true,
    update: ({ req }) => req.user?.collection === "users",
  },
  fields: [
    {
      name: "coupleNames",
      label: "Navn",
      type: "text",
      required: true,
      defaultValue: "Andrea & Martin",
    },
    {
      name: "weddingDate",
      label: "Bryllupsdato",
      type: "date",
      required: true,
      defaultValue: "2027-07-27T00:00:00+02:00",
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "welcomeMessage",
      label: "Velkomsttekst",
      type: "textarea",
      defaultValue: "Vi gleder oss til å feire sammen med dere.",
    },
    { name: "venue", label: "Sted", type: "text", admin: { description: "Vises sammen med datoen, f.eks. Skottland." } },
    {
      type: "collapsible",
      label: "Utseende på forsiden",
      fields: [
        { name: "heroEyebrow", label: "Tekst over navnene", type: "text", defaultValue: "Vi gifter oss", maxLength: 120 },
        { name: "heroTitleSuffix", label: "Tekst under navnene", type: "text", defaultValue: "sitt bryllup", maxLength: 120 },
        {
          name: "heroBackgroundMode", label: "Bakgrunn", type: "radio", required: true, defaultValue: "color",
          options: [{ label: "Bilde", value: "image" }, { label: "Farge", value: "color" }],
        },
        {
          name: "heroImage", label: "Bilde på forsiden", type: "upload", relationTo: "media",
          admin: {
            condition: (data) => data.heroBackgroundMode === "image",
            description: "Velg eller last opp et bilde. Bruk bildeverktøyets fokuspunkt for å beholde ansikter i utsnittet på mobil. Uten bilde brukes bakgrunnsfargen. Forsidebildet er offentlig.",
          },
        },
        {
          name: "heroBackgroundColor", label: "Bakgrunnsfarge", type: "text", required: true, defaultValue: DEFAULT_HERO_COLOR,
          validate: (value: unknown) => isHexColor(value) || "Velg en farge eller skriv en fargekode med seks tegn, f.eks. #3c4641.",
          admin: {
            description: "Brukes når du velger Farge, og som reserve hvis et bilde mangler.",
            components: { Field: "/components/admin/fields/ColorField#ColorField" },
          },
        },
      ],
    },
    { name: "travelInformation", label: "Reiseinformasjon", type: "richText", access: { read: canReadGuestContent } },
  ],
};
