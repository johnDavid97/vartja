"use client";

import { Button } from "@/components/ui/button";

export default function CheckApprovalButton() {
  return <Button type="button" onClick={() => window.location.reload()}>Sjekk godkjenning</Button>;
}
