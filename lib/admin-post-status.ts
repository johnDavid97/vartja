export function adminPostStatus(status: unknown, visibility: unknown) {
  if (status === "changed") return { tone: "draft", label: visibility === "private" ? "Endringer · privat" : "Upubliserte endringer" };
  if (status !== "published") return { tone: "draft", label: visibility === "private" ? "Utkast · privat" : "Utkast" };
  if (visibility === "private") return { tone: "private", label: "Privat" };
  return { tone: "published", label: "Publisert" };
}
