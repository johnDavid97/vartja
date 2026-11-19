const articleDateFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Oslo",
});

export interface ArticleDate {
  iso: string;
  label: string;
}

/** Prefer publication time, but keep legacy published posts readable when it is absent or invalid. */
export function articleDate(publishedAt: string | null | undefined, createdAt: string): ArticleDate | null {
  for (const value of [publishedAt, createdAt]) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    return { iso: date.toISOString(), label: articleDateFormatter.format(date) };
  }
  return null;
}
