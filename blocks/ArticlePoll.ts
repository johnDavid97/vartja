import type { Block } from "payload";

export const ArticlePoll: Block = {
  slug: "poll",
  interfaceName: "ArticlePollBlock",
  labels: { singular: "Avstemning", plural: "Avstemninger" },
  admin: { components: { Block: "/components/admin/editor/PollBlock#PollBlock" } },
  fields: [
    { name: "question", label: "Spørsmål", type: "text", required: true, maxLength: 200 },
    {
      name: "options", label: "Svaralternativer", type: "array", required: true,
      minRows: 2, maxRows: 10,
      labels: { singular: "alternativ", plural: "alternativer" },
      fields: [{ name: "label", label: "Svar", type: "text", required: true, maxLength: 120 }],
    },
    {
      name: "open", label: "Åpen for stemmer", type: "checkbox", defaultValue: true,
      admin: { description: "Slå av og publiser for å avslutte avstemningen. Resultatene blir fortsatt vist. Etter første stemme kan spørsmål og svar ikke endres; lag en ny avstemning i stedet." },
    },
  ],
};
