import { householdStatus } from "@/lib/household-admin-presentation";
import styles from "./household-workspace.module.css";

/** One status presentation for the overview, document header and approval card. */
export function HouseholdStatusBadge({ value, label, live = false }: { value: unknown; label?: string; live?: boolean }) {
  const status = householdStatus(value);
  return <span className={`${styles.status} ${styles[`status_${status.tone}`]}`} role={live ? "status" : undefined}>{label ?? status.label}</span>;
}
