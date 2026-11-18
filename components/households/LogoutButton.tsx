"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/household-logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Logout failed");
      // A full navigation clears the previous authenticated Router Cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard cached private routes after logout.
      window.location.assign("/");
    } catch {
      setError("Kunne ikke logge ut. Prøv igjen.");
      setPending(false);
    }
  }
  return <span><Button variant="ghost" type="button" disabled={pending} onClick={logout}>{pending ? "Logger ut …" : "Logg ut"}</Button>{error ? <span role="alert" className="block text-sm text-red-800">{error}</span> : null}</span>;
}
