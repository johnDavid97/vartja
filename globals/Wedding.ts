import type { GlobalConfig } from "payload";

export const Wedding: GlobalConfig = {
  slug: "wedding",
  label: "Bryllupsinformasjon",
  admin: {
    group: "Bryllupet",
    description: "Navn, dato og velkomsttekst vises på forsiden. Reiseinformasjon og tidsplan kobles til egne sider senere.",
  },
  access: {
    // Only public wedding information belongs in this global.
    read: () => true,
    update: ({ req }) => Boolean(req.user),
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
    { name: "venue", label: "Sted", type: "text" },
    { name: "travelInformation", label: "Reiseinformasjon", type: "richText" },
    {
      name: "schedule",
      label: "Tidsplan",
      type: "array",
      fields: [
        { name: "title", label: "Hendelse", type: "text", required: true },
        {
          name: "time",
          label: "Tidspunkt",
          type: "date",
          required: true,
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
        { name: "description", label: "Beskrivelse", type: "textarea" },
      ],
    },
  ],
};
