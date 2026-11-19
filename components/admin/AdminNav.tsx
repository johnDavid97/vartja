import { getWeddingBranding } from "@/features/wedding-site/branding-server";
import AdminNavClient from "./AdminNavClient";

export default async function AdminNav() {
  return <AdminNavClient branding={await getWeddingBranding()} />;
}
